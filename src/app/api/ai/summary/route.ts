import { NextRequest } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '@/lib/constants';
import { buildSummaryPrompt } from '@/lib/ai-prompt';
import { loadProjectForAi, updateAiCache } from '@/lib/ai-project';
import {
  SUMMARY_LANGS,
  buildFallbackSummary,
  coerceSummary,
  hashFacts,
  parseSummaryCache,
  type PlainSummary,
  type SummaryLang,
} from '@/lib/ai-summary';

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    whatItIs: { type: Type.STRING },
    whereItStands: { type: Type.STRING },
    whatToWatch: { type: Type.ARRAY, items: { type: Type.STRING } },
    whatYouCanDo: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['headline', 'whatItIs', 'whereItStands', 'whatToWatch', 'whatYouCanDo'],
};

/** Dedupe concurrent generations for the same project + language + data. */
const inFlight = new Map<string, Promise<{ summary: PlainSummary; source: 'ai' | 'fallback' }>>();

async function generate(
  prompt: string,
  fallback: PlainSummary
): Promise<{ summary: PlainSummary; source: 'ai' | 'fallback' }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { summary: fallback, source: 'fallback' };
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.3,
      },
    });
    if (!response.text) return { summary: fallback, source: 'fallback' };
    return { summary: coerceSummary(JSON.parse(response.text), fallback), source: 'ai' };
  } catch (err) {
    console.warn('AI summary failed, using plain fallback:', err);
    return { summary: fallback, source: 'fallback' };
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { projectId?: unknown; lang?: unknown } | null;
  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
  const lang: SummaryLang = SUMMARY_LANGS.includes(body?.lang as SummaryLang) ? (body!.lang as SummaryLang) : 'en';

  if (!projectId) {
    return Response.json({ error: 'projectId is required' }, { status: 400 });
  }

  try {
    const loaded = await loadProjectForAi(projectId);
    if (!loaded) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    const { project, facts, riskScore } = loaded;
    const hash = hashFacts(facts);

    const cache = parseSummaryCache(project.aiSummary);
    const hit = cache.entries[lang];
    if (hit && hit.hash === hash) {
      return Response.json({ summary: hit.summary, riskScore, cached: true, source: 'ai' });
    }

    const fallback = buildFallbackSummary(facts, lang);
    const key = `${projectId}:${lang}:${hash}`;
    let pending = inFlight.get(key);
    if (!pending) {
      pending = generate(buildSummaryPrompt(facts, lang), fallback).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    const { summary, source } = await pending;

    // Only cache real AI output; the fallback is cheap to rebuild and should be retried later.
    if (source === 'ai') {
      await updateAiCache(projectId, (cache) => {
        cache.entries[lang] = { hash, summary };
      });
    }

    return Response.json({ summary, riskScore, cached: false, source });
  } catch (error) {
    console.error('Error generating project summary:', error);
    return Response.json({ error: 'Could not make a summary right now. Please try again.' }, { status: 500 });
  }
}
