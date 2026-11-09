import { NextRequest } from 'next/server';
import { GoogleGenAI, Type, createPartFromBase64, createUserContent } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '@/lib/constants';
import { isPlaceholderCoords } from '@/lib/location';
import { getSiteImage } from '@/lib/satellite';
import {
  pickReleases,
  type PhotoInfo,
  type SatelliteCheckResponse,
  type WaybackRelease,
} from '@/lib/satellite-releases';
import { buildSatellitePrompt } from '@/lib/ai-prompt';
import { loadProjectForAi, updateAiCache } from '@/lib/ai-project';
import {
  SUMMARY_LANGS,
  coerceVerdict,
  isHardToSeeFromAbove,
  parseSummaryCache,
  type SatelliteVerdict,
  type SummaryLang,
} from '@/lib/ai-summary';

/**
 * POST /api/ai/satellite  { projectId, lang }
 *
 * Compares the satellite photo from before work started with the newest one
 * and asks Gemini what visibly changed. Always answers 200 with a `status` so
 * the page can explain itself; it never fails with a 500.
 */

const PROMPT_VERSION = 2;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    changeSeen: { type: Type.STRING, enum: ['clear', 'some', 'none', 'cannot_tell'] },
    whatChanged: { type: Type.STRING },
    matchesReport: { type: Type.STRING, enum: ['yes', 'partly', 'no', 'unclear'] },
    explanation: { type: Type.STRING },
    caveats: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['changeSeen', 'whatChanged', 'matchesReport', 'explanation', 'caveats'],
};

const inFlight = new Map<string, Promise<SatelliteVerdict | null>>();

function photoInfo(projectId: string, when: 'start' | 'latest', r: WaybackRelease): PhotoInfo {
  return {
    year: r.year,
    releaseDate: r.releaseDate,
    url: `/api/projects/${encodeURIComponent(projectId)}/satellite?when=${when}`,
  };
}

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

async function askGemini(
  prompt: string,
  before: Buffer,
  after: Buffer,
  lang: SummaryLang,
  hardToSee: boolean
): Promise<SatelliteVerdict | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: createUserContent([
      prompt,
      'Image 1 (BEFORE):',
      createPartFromBase64(before.toString('base64'), 'image/jpeg'),
      'Image 2 (AFTER):',
      createPartFromBase64(after.toString('base64'), 'image/jpeg'),
    ]),
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.2 },
  });
  if (!response.text) return null;
  return coerceVerdict(JSON.parse(response.text), lang, hardToSee);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { projectId?: unknown; lang?: unknown } | null;
  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
  const lang: SummaryLang = SUMMARY_LANGS.includes(body?.lang as SummaryLang) ? (body!.lang as SummaryLang) : 'en';
  const reply = (r: SatelliteCheckResponse) => Response.json(r);

  if (!projectId) return Response.json({ error: 'projectId is required' }, { status: 400 });

  try {
    const loaded = await loadProjectForAi(projectId);
    if (!loaded) return reply({ status: 'unavailable', reason: 'not_found' });
    const { project, facts } = loaded;

    if (isPlaceholderCoords(project.gpsLat, project.gpsLng)) {
      return reply({ status: 'unavailable', reason: 'no_location' });
    }

    const pair = pickReleases(project.startDate);
    const before = photoInfo(projectId, 'start', pair.before);
    const after = photoInfo(projectId, 'latest', pair.after);
    const base = { before, after, startsBeforeArchive: pair.startsBeforeArchive };

    if (pair.noPhotoSinceStart) return reply({ status: 'unavailable', reason: 'too_recent', ...base });

    let images;
    try {
      images = await Promise.all([
        getSiteImage(project.gpsLat, project.gpsLng, pair.before),
        getSiteImage(project.gpsLat, project.gpsLng, pair.after),
      ]);
    } catch {
      return reply({ status: 'unavailable', reason: 'imagery', ...base });
    }
    const [beforeImg, afterImg] = images;

    // Wayback served the same underlying photo for both dates: nothing to compare yet.
    if (beforeImg.photoId === afterImg.photoId) return reply({ status: 'same_photo', ...base });

    const key = `v${PROMPT_VERSION}|${beforeImg.photoId}|${afterImg.photoId}|${facts.workPct}|${facts.status}`;
    const cached = parseSummaryCache(project.aiSummary).satellite?.[lang];
    if (cached && cached.key === key) {
      return reply({ status: 'ok', ...base, verdict: cached.verdict, cached: true });
    }

    const flightKey = `${projectId}:${lang}:${key}`;
    let pending = inFlight.get(flightKey);
    if (!pending) {
      const prompt = buildSatellitePrompt(
        {
          facts,
          beforeLabel: `Esri photo archive, published ${monthYear(pair.before.releaseDate)} (the photo itself may be older)`,
          afterLabel: `Esri photo archive, published ${monthYear(pair.after.releaseDate)} (the photo itself may be older)`,
          startsBeforeArchive: pair.startsBeforeArchive,
        },
        lang
      );
      pending = askGemini(prompt, beforeImg.jpeg, afterImg.jpeg, lang, isHardToSeeFromAbove(facts.name, facts.category))
        .catch((err) => {
          console.warn(`[ai/satellite ${projectId}] Gemini failed:`, err);
          return null;
        })
        .finally(() => inFlight.delete(flightKey));
      inFlight.set(flightKey, pending);
    }

    const verdict = await pending;
    if (!verdict) {
      return reply({ status: 'unavailable', reason: process.env.GEMINI_API_KEY ? 'error' : 'ai_off', ...base });
    }

    await updateAiCache(projectId, (cache) => {
      cache.satellite = { ...(cache.satellite ?? {}), [lang]: { key, verdict } };
    });

    return reply({ status: 'ok', ...base, verdict, cached: false });
  } catch (err) {
    console.error(`[ai/satellite ${projectId}] failed:`, err);
    return reply({ status: 'unavailable', reason: 'error' });
  }
}
