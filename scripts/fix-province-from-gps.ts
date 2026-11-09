/**
 * Re-assign Project.provinceId from each project's GPS point.
 *
 * Why: the original import put every project whose province it could not work
 * out into the first province (Ilocos Norte, ~50k rows), so lists and search
 * showed e.g. Candaba (Pampanga) as "Ilocos Norte".
 *
 * Safety:
 *  - DRY RUN by default. Pass --apply to write.
 *  - Placeholder coordinates (the shared Manila point) are never touched.
 *  - Only updates when the GPS point falls inside exactly one known province
 *    polygon AND that province exists in the DB (ambiguous names are skipped).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/fix-province-from-gps.ts          # report only
 *   npx tsx --tsconfig tsconfig.json scripts/fix-province-from-gps.ts --apply  # write
 */
import { prisma } from '@/lib/prisma';
import { resolveProvinceAndRegion } from '@/lib/geo-spatial';
import { isPlaceholderCoords } from '@/lib/location';

const APPLY = process.argv.includes('--apply');
const PAGE = 5000;
const UPDATE_BATCH = 500;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** Polygon names that were renamed in the DB. Ambiguous splits (Maguindanao) map to null = skip. */
const ALIASES: Record<string, string | null> = {
  compostelavalley: 'davaodeoro',
  northcotabato: 'cotabato',
  maguindanao: null,
  shariffkabunsuan: null,
};

async function main() {
  const provinces = await prisma.province.findMany({ select: { id: true, name: true } });
  const byName = new Map(provinces.map((p) => [norm(p.name), p]));
  const nameById = new Map(provinces.map((p) => [p.id, p.name]));

  const resolveDbProvince = (polygonName: string) => {
    const key = norm(polygonName);
    const target = key in ALIASES ? ALIASES[key] : key;
    return target ? byName.get(target) ?? null : null;
  };

  const moves = new Map<string, string[]>(); // targetProvinceId -> project ids
  const pairCounts = new Map<string, number>();
  const samples: string[] = [];
  let scanned = 0, placeholder = 0, unresolved = 0, unmatchedName = 0, alreadyRight = 0;

  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.project.findMany({
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, name: true, gpsLat: true, gpsLng: true, provinceId: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      scanned++;
      if (isPlaceholderCoords(r.gpsLat, r.gpsLng)) { placeholder++; continue; }
      const spatial = resolveProvinceAndRegion(r.gpsLng, r.gpsLat);
      if (!spatial) { unresolved++; continue; }
      const target = resolveDbProvince(spatial.province);
      if (!target) { unmatchedName++; continue; }
      if (target.id === r.provinceId) { alreadyRight++; continue; }

      const list = moves.get(target.id) ?? [];
      list.push(r.id);
      moves.set(target.id, list);
      const pair = `${nameById.get(r.provinceId) ?? '?'} -> ${target.name}`;
      pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
      if (samples.length < 8) samples.push(`  ${r.id}  ${pair}  "${r.name.slice(0, 60)}"`);
    }
    process.stdout.write(`\rscanned ${scanned}...`);
  }

  const toMove = [...moves.values()].reduce((s, l) => s + l.length, 0);
  console.log(`\n\n${APPLY ? 'APPLY' : 'DRY RUN'} summary`);
  console.log({ scanned, alreadyRight, toMove, skippedPlaceholder: placeholder, skippedNoPolygon: unresolved, skippedAmbiguousName: unmatchedName });
  console.log('\nTop changes (stored -> GPS):');
  for (const [pair, n] of [...pairCounts].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${String(n).padStart(6)}  ${pair}`);
  console.log('\nSamples:\n' + samples.join('\n'));

  if (!APPLY) {
    console.log('\nNothing was written. Re-run with --apply to update the database.');
    return;
  }

  let done = 0;
  for (const [provinceId, ids] of moves) {
    for (let i = 0; i < ids.length; i += UPDATE_BATCH) {
      const chunk = ids.slice(i, i + UPDATE_BATCH);
      await prisma.project.updateMany({ where: { id: { in: chunk } }, data: { provinceId } });
      done += chunk.length;
      process.stdout.write(`\rupdated ${done}/${toMove}`);
    }
  }
  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
