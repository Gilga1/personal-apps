export interface Track {
  id: string;
  file_path: string;
  title: string;
  artist: string;
  album: string;
  year?: number | null;
  genre?: string | null;
  duration_sec?: number | null;
  format: string;
  tag_source: string;
  folder_path?: string | null;
  mood: string;
  mood_source: string;
  energy_score?: number | null;
  situational_tags: string[];
}

export type LlmProvider = "ollama" | "openai" | "openrouter" | "gemini";

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  api_key?: string | null;
  base_url?: string | null;
  ollama_host?: string | null;
}

export interface LlmProviderInfo {
  id: string;
  label: string;
  models: string[];
}

export interface IngestJob {
  id: string;
  source_url: string;
  status: string;
  output_path?: string | null;
  error?: string | null;
}

export interface IngestProgressEvent {
  job_id: string;
  status: string;
  progress: number;
  message: string;
  track_id?: string | null;
  track_ids?: string[];
  playlist_id?: string | null;
}

export interface EnrichProgressEvent {
  current: number;
  total: number;
  message: string;
}

export interface EnrichResult {
  rule_tagged: number;
  total: number;
  rule_enriched: number;
  llm_enriched: number;
  failed: number;
  last_error?: string | null;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  created_from?: string | null;
  created_at: string;
  track_count: number;
}
