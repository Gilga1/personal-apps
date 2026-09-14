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
