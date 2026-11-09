/**
 * Plain-language project summary: shared types, facts builder, data hash,
 * deterministic fallback text (EN / FIL), and cache (de)serialization.
 *
 * Numbers and the warning level are ALWAYS computed in code. The AI only
 * explains them in simple words — it never invents figures or observations.
 */
import { formatCurrency, formatDate } from '@/lib/format';

export type SummaryLang = 'en' | 'fil';
export const SUMMARY_LANGS: SummaryLang[] = ['en', 'fil'];

export interface PlainSummary {
  headline: string;
  whatItIs: string;
  whereItStands: string;
  whatToWatch: string[];
  whatYouCanDo: string[];
  lang: SummaryLang;
}

export type WarningLevel = 'low' | 'some' | 'high' | 'very_high';

/** Same thresholds as getRiskScoreTier in anomaly-flags.ts. */
export function getWarningLevel(score: number): WarningLevel {
  if (score >= 81) return 'very_high';
  if (score >= 61) return 'high';
  if (score >= 31) return 'some';
  return 'low';
}

export const WARNING_LABELS: Record<SummaryLang, Record<WarningLevel, string>> = {
  en: { low: 'Low', some: 'Some concerns', high: 'High', very_high: 'Very high' },
  fil: { low: 'Mababa', some: 'May ilang alalahanin', high: 'Mataas', very_high: 'Napakataas' },
};

type FlagKey = 'overpaid' | 'stalled' | 'overdue' | 'neverStarted' | 'paymentPending';

export const FLAG_TEXT: Record<SummaryLang, Record<FlagKey, string>> = {
  en: {
    overpaid: 'Most of the money has been paid, but less than 30% of the work is reported done.',
    stalled: 'There has been no progress update for more than 6 months.',
    overdue: 'The deadline has passed, but the project is not marked finished.',
    neverStarted: 'The start date has passed, but no work has been reported yet.',
    paymentPending: 'The work is reported finished, but no payment is recorded yet.',
  },
  fil: {
    overpaid: 'Halos buong pera ay nabayaran na, pero wala pang 30% ng trabaho ang naiulat na tapos.',
    stalled: 'Walang update sa progreso nang mahigit 6 na buwan.',
    overdue: 'Lumampas na sa deadline, pero hindi pa nakamarkang tapos ang proyekto.',
    neverStarted: 'Lumipas na ang petsa ng simula, pero wala pang naiulat na trabaho.',
    paymentPending: 'Naiulat na tapos ang trabaho, pero wala pang naitalang bayad.',
  },
};

export interface SummaryFactsInput {
  id: string;
  name: string;
  category: string;
  status: string;
  contractorRaw: string | null;
  budgetPHP: number;
  amountPaid: number;
  progress: number;
  startDate: Date | string | null;
  completionDate: Date | string | null;
  provinceName?: string | null;
  regionName?: string | null;
  flagOverpaid: boolean;
  flagStalled: boolean;
  flagOverdue: boolean;
  flagNeverStarted: boolean;
  flagPaymentPending: boolean;
  riskScore: number;
  reviews: Array<{
    rating: number;
    progressRating?: number | null;
    workersActive?: boolean | null;
    comment: string;
  }>;
}

export interface SummaryFacts {
  name: string;
  category: string;
  status: string;
  contractor: string;
  location: string;
  budget: string;
  paid: string;
  paidPct: number | null;
  workPct: number;
  gapPct: number | null;
  start: string;
  deadline: string;
  flags: FlagKey[];
  riskScore: number;
  warningLevel: WarningLevel;
  reviewCount: number;
  avgRating: number | null;
  avgSeenProgress: number | null;
  workersSeen: number;
  noWorkersSeen: number;
  comments: string[];
}

export function buildFacts(p: SummaryFactsInput): SummaryFacts {
  const paidPct = p.budgetPHP > 0 ? Math.round((p.amountPaid / p.budgetPHP) * 100) : null;
  const workPct = Math.round(p.progress || 0);
  const flags: FlagKey[] = [];
  if (p.flagOverpaid) flags.push('overpaid');
  if (p.flagStalled) flags.push('stalled');
  if (p.flagOverdue) flags.push('overdue');
  if (p.flagNeverStarted) flags.push('neverStarted');
  if (p.flagPaymentPending) flags.push('paymentPending');

  const seen = p.reviews
    .map((r) => r.progressRating)
    .filter((v): v is number => typeof v === 'number');
  const avgRating =
    p.reviews.length > 0 ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : null;

  return {
    name: p.name,
    category: p.category || 'Infrastructure',
    status: p.status || 'Unknown',
    contractor: (p.contractorRaw || 'Unknown').replace(/\s*\([^)]*\)\s*$/, '').trim(),
    location: [p.provinceName, p.regionName].filter(Boolean).join(', ') || 'the Philippines',
    budget: formatCurrency(p.budgetPHP || 0),
    paid: formatCurrency(p.amountPaid || 0),
    paidPct,
    workPct,
    gapPct: paidPct === null ? null : paidPct - workPct,
    start: p.startDate ? formatDate(p.startDate) : 'unknown',
    deadline: p.completionDate ? formatDate(p.completionDate) : 'not given',
    flags,
    riskScore: p.riskScore,
    warningLevel: getWarningLevel(p.riskScore),
    reviewCount: p.reviews.length,
    avgRating: avgRating === null ? null : Math.round(avgRating * 10) / 10,
    avgSeenProgress: seen.length ? Math.round(seen.reduce((a, b) => a + b, 0) / seen.length) : null,
    workersSeen: p.reviews.filter((r) => r.workersActive === true).length,
    noWorkersSeen: p.reviews.filter((r) => r.workersActive === false).length,
    // Cap length; these are untrusted citizen text.
    comments: p.reviews.slice(0, 5).map((r) => r.comment.slice(0, 280)),
  };
}

/** Small, isomorphic, stable string hash (FNV-1a). Changes when the data changes. */
export function hashFacts(f: SummaryFacts): string {
  const key = JSON.stringify([
    f.name, f.status, f.budget, f.paid, f.paidPct, f.workPct, f.deadline,
    f.flags, f.riskScore, f.reviewCount, f.avgSeenProgress, PROMPT_VERSION,
  ]);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Bump when the prompt or summary shape changes, to invalidate caches. */
export const PROMPT_VERSION = 1;

// ─── Fallback (no AI available) ──────────────────────────────

export function buildFallbackSummary(f: SummaryFacts, lang: SummaryLang): PlainSummary {
  const fil = lang === 'fil';
  const watch = f.flags.map((k) => FLAG_TEXT[lang][k]);

  if (f.gapPct !== null && f.gapPct >= 25 && !f.flags.includes('overpaid')) {
    watch.push(
      fil
        ? `Mas malaki ang nabayaran (${f.paidPct}%) kaysa sa naiulat na tapos na trabaho (${f.workPct}%).`
        : `More money has been paid (${f.paidPct}%) than work reported done (${f.workPct}%).`
    );
  }
  if (f.avgSeenProgress !== null && f.workPct - f.avgSeenProgress >= 25) {
    watch.push(
      fil
        ? `Ayon sa mga ulat ng mamamayan, mga ${f.avgSeenProgress}% lang ang mukhang tapos — mas mababa kaysa sa ulat ng DPWH.`
        : `Citizen reports say only about ${f.avgSeenProgress}% looks done — lower than the DPWH report.`
    );
  }

  const paidLine =
    f.paidPct === null
      ? fil ? 'Hindi alam kung magkano na ang nabayaran.' : 'We do not know how much has been paid.'
      : fil
        ? `${f.paid} (${f.paidPct}%) na ang nabayaran, at ${f.workPct}% ng trabaho ang naiulat na tapos.`
        : `${f.paid} (${f.paidPct}%) has been paid so far, and ${f.workPct}% of the work is reported done.`;

  const headline =
    watch.length === 0
      ? fil ? 'Walang nakitang problema sa mga opisyal na rekord.' : 'No problems found in the official records.'
      : fil ? `May ${watch.length} bagay na dapat bantayan sa proyektong ito.` : `There ${watch.length === 1 ? 'is 1 thing' : `are ${watch.length} things`} to watch on this project.`;

  return {
    lang,
    headline,
    whatItIs: fil
      ? `Isang proyektong ${f.category.toLowerCase()} sa ${f.location}, na ginagawa ng ${f.contractor}. Ang budget ay ${f.budget}.`
      : `A ${f.category.toLowerCase()} project in ${f.location}, built by ${f.contractor}. The budget is ${f.budget}.`,
    whereItStands: `${paidLine} ${
      fil ? `Status: ${f.status}. Deadline: ${f.deadline}.` : `Status: ${f.status}. Deadline: ${f.deadline}.`
    }`,
    whatToWatch: watch,
    whatYouCanDo: [
      fil
        ? 'Kung malapit ka, kumuha ng litrato ng site at magsumite ng ulat dito.'
        : 'If you live nearby, take a photo of the site and send a report here.',
      fil
        ? 'Tingnan ang opisyal na kontrata gamit ang "View Document" na button.'
        : 'Check the official contract using the "View Document" button.',
      ...(watch.length > 0
        ? [
            fil
              ? 'Maaari mong itanong ito sa inyong barangay, sa DPWH district office, o sa COA.'
              : 'You can ask about this at your barangay, the DPWH district office, or COA.',
          ]
        : []),
    ],
  };
}

// ─── Cache stored in Project.aiSummary ───────────────────────

export interface SummaryCache {
  v: 1;
  entries: Partial<Record<SummaryLang, { hash: string; summary: PlainSummary }>>;
  /** Satellite photo comparison verdicts, keyed by language. */
  satellite?: Partial<Record<SummaryLang, { key: string; verdict: SatelliteVerdict }>>;
}

/** Parse cache; legacy plain-string summaries are ignored (they get regenerated). */
export function parseSummaryCache(raw: string | null | undefined): SummaryCache {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1 && typeof parsed.entries === 'object') {
        return {
          v: 1,
          entries: parsed.entries ?? {},
          ...(parsed.satellite && typeof parsed.satellite === 'object' ? { satellite: parsed.satellite } : {}),
        };
      }
    } catch {
      /* legacy plain-text value */
    }
  }
  return { v: 1, entries: {} };
}

// ─── Satellite photo comparison ──────────────────────────────

export type ChangeSeen = 'clear' | 'some' | 'none' | 'cannot_tell';
export type MatchesReport = 'yes' | 'partly' | 'no' | 'unclear';

export interface SatelliteVerdict {
  lang: SummaryLang;
  changeSeen: ChangeSeen;
  matchesReport: MatchesReport;
  /** What looks different between the two photos, in plain words. */
  whatChanged: string;
  /** How that compares with what the records say. */
  explanation: string;
  caveats: string[];
}

const CHANGE_SEEN: ChangeSeen[] = ['clear', 'some', 'none', 'cannot_tell'];
const MATCHES: MatchesReport[] = ['yes', 'partly', 'no', 'unclear'];

/** Work that is often invisible from above, so "no visible change" must not read as "does not match". */
const HARD_TO_SEE = /rehab|repair|restor|mainten|resurfac|overlay|drain|desilt|dredg|retrofit|upgrad|improv|preventive/i;

export function isHardToSeeFromAbove(name: string, category = ''): boolean {
  return HARD_TO_SEE.test(`${name} ${category}`);
}

/** Validate the model's JSON. Anything unexpected degrades to "cannot tell", never to a stronger claim. */
export function coerceVerdict(raw: unknown, lang: SummaryLang, hardToSee = false): SatelliteVerdict | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const whatChanged = str(o.whatChanged);
  const explanation = str(o.explanation);
  if (!whatChanged && !explanation) return null;
  const changeSeen = CHANGE_SEEN.includes(o.changeSeen as ChangeSeen) ? (o.changeSeen as ChangeSeen) : 'cannot_tell';
  const matchesReport = MATCHES.includes(o.matchesReport as MatchesReport) ? (o.matchesReport as MatchesReport) : 'unclear';
  return {
    lang,
    changeSeen,
    // "Matches / doesn't match" is meaningless if the model could not see a change,
    // and "no change" on repair-type work is not evidence of a mismatch.
    matchesReport:
      changeSeen === 'cannot_tell' || (hardToSee && changeSeen === 'none' && matchesReport === 'no')
        ? 'unclear'
        : matchesReport,
    whatChanged,
    explanation,
    caveats: Array.isArray(o.caveats)
      ? o.caveats.filter((c): c is string => typeof c === 'string' && !!c.trim()).map((c) => c.trim()).slice(0, 4)
      : [],
  };
}

/** Validate an AI JSON response into a PlainSummary, falling back field-by-field. */
export function coerceSummary(raw: unknown, fallback: PlainSummary): PlainSummary {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, fb: string) => (typeof v === 'string' && v.trim() ? v.trim() : fb);
  const list = (v: unknown, fb: string[]) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 5) : fb;
  return {
    lang: fallback.lang,
    headline: str(o.headline, fallback.headline),
    whatItIs: str(o.whatItIs, fallback.whatItIs),
    whereItStands: str(o.whereItStands, fallback.whereItStands),
    whatToWatch: list(o.whatToWatch, fallback.whatToWatch),
    whatYouCanDo: list(o.whatYouCanDo, fallback.whatYouCanDo).length
      ? list(o.whatYouCanDo, fallback.whatYouCanDo)
      : fallback.whatYouCanDo,
  };
}
