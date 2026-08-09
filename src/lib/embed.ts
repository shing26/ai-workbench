export const EMBED_DIM = 256;
export type EmbeddingMode = 'local' | 'openai' | 'ollama';

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

function fnv1a(bytes: Uint8Array, seed: number): number {
  let hash = seed >>> 0;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function isAlphanumeric(char: string): boolean {
  return /^[\p{L}\p{N}]$/u.test(char);
}

function wordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1);
}

function extractFeatures(text: string): string[] {
  const lower = text.toLowerCase();
  const chars = Array.from(lower).filter(isAlphanumeric);
  const features = new Set<string>();
  for (const word of wordTokens(text)) {
    features.add(word);
  }
  for (let width = 1; width <= 4; width += 1) {
    for (let i = 0; i + width <= chars.length; i += 1) {
      features.add(chars.slice(i, i + width).join(''));
    }
  }
  return [...features];
}

const encoder = new TextEncoder();

export function shardFor(key: string, shardCount: number): string {
  const count = Math.max(1, Math.min(64, shardCount));
  return String((fnv1a(encoder.encode(key), FNV_OFFSET) >>> 0) % count);
}

export function embedText(text: string): number[] {
  const vector = new Array<number>(EMBED_DIM).fill(0);
  for (const feature of extractFeatures(text)) {
    const bytes = encoder.encode(feature);
    const bucket = fnv1a(bytes, FNV_OFFSET) % EMBED_DIM;
    const sign = (fnv1a(bytes, FNV_PRIME) & 1) === 0 ? 1 : -1;
    vector[bucket] += sign;
  }
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  }
  return vector;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

export function hybridRagScore(bm25: number, vectorScore: number): number {
  return bm25 + 1.2 * vectorScore;
}

export async function embedTextRemote(
  mode: EmbeddingMode,
  baseUrl: string,
  apiKey: string,
  model: string,
  text: string,
): Promise<number[]> {
  if (mode === 'local') return embedText(text);
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('Embedding base URL is empty');
  const url = mode === 'ollama' ? `${base}/api/embed` : `${base}/embeddings`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
      },
      body: JSON.stringify({ model: model.trim() || 'default', input: text }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Embedding HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    const json = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      embeddings?: number[][];
    };
    const candidate = mode === 'ollama' ? json.embeddings?.[0] : json.data?.[0]?.embedding;
    if (!candidate || candidate.length === 0) {
      throw new Error('Embedding response missing embedding vector');
    }
    return candidate;
  } finally {
    window.clearTimeout(timer);
  }
}
