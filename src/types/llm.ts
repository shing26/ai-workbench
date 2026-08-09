export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'completed' | 'error';

export interface InspectorMetrics {
  providerName: string;
  modelName: string;
  baseUrl: string;
  temperature: number;
  ttftMs: number | null;
  totalTokens: number;
  tokensPerSec: number;
  contextUsed: number;
  contextLimit: number;
  status: StreamStatus;
  lastError?: string;
}
