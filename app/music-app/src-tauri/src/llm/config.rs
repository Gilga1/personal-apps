use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LlmProvider {
    Ollama,
    Openai,
    Openrouter,
    Gemini,
}

impl LlmProvider {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "openai" => Self::Openai,
            "openrouter" => Self::Openrouter,
            "gemini" => Self::Gemini,
            _ => Self::Ollama,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Ollama => "ollama",
            Self::Openai => "openai",
            Self::Openrouter => "openrouter",
            Self::Gemini => "gemini",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider: LlmProvider,
    pub model: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub ollama_host: Option<String>,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            provider: LlmProvider::Ollama,
            model: "llama3.2:3b".to_string(),
            api_key: None,
            base_url: None,
            ollama_host: Some("http://localhost:11434".to_string()),
        }
    }
}

const SETTINGS_KEY: &str = "llm_config";

pub fn config_file_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("stacks").join("config.toml"))
}

pub fn load_config(db_get: Option<&str>) -> LlmConfig {
    if let Some(json) = db_get {
        if let Ok(cfg) = serde_json::from_str::<LlmConfig>(json) {
            return apply_env_overrides(cfg);
        }
    }

    if let Some(path) = config_file_path() {
        if path.exists() {
            if let Ok(text) = fs::read_to_string(&path) {
                if let Ok(cfg) = parse_toml_config(&text) {
                    return apply_env_overrides(cfg);
                }
            }
        }
    }

    apply_env_overrides(LlmConfig::default())
}

fn parse_toml_config(text: &str) -> Result<LlmConfig, String> {
    let mut provider = "ollama".to_string();
    let mut model = "llama3.2:3b".to_string();
    let mut api_key: Option<String> = None;
    let mut base_url: Option<String> = None;
    let mut ollama_host: Option<String> = None;

    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        if let Some((key, val)) = line.split_once('=') {
            let key = key.trim();
            let val = val.trim().trim_matches('"');
            match key {
                "provider" => provider = val.to_string(),
                "model" => model = val.to_string(),
                "api_key" => api_key = Some(val.to_string()).filter(|s| !s.is_empty()),
                "base_url" => base_url = Some(val.to_string()).filter(|s| !s.is_empty()),
                "host" => ollama_host = Some(val.to_string()),
                _ => {}
            }
        }
    }

    Ok(LlmConfig {
        provider: LlmProvider::from_str(&provider),
        model,
        api_key,
        base_url,
        ollama_host,
    })
}

fn apply_env_overrides(cfg: LlmConfig) -> LlmConfig {
    let provider = env::var("STACKS_LLM_PROVIDER")
        .map(|p| LlmProvider::from_str(&p))
        .unwrap_or(cfg.provider);
    let model = env::var("STACKS_LLM_MODEL").unwrap_or(cfg.model);
    let api_key = env::var("STACKS_LLM_API_KEY")
        .ok()
        .or(cfg.api_key)
        .or_else(|| resolve_provider_api_key(&provider));
    let base_url = env::var("STACKS_LLM_BASE_URL").ok().or(cfg.base_url);
    let ollama_host = env::var("OLLAMA_HOST")
        .ok()
        .or(cfg.ollama_host)
        .or_else(|| Some("http://localhost:11434".to_string()));

    LlmConfig {
        provider,
        model,
        api_key,
        base_url,
        ollama_host,
    }
}

fn resolve_provider_api_key(provider: &LlmProvider) -> Option<String> {
    match provider {
        LlmProvider::Openai => env::var("OPENAI_API_KEY").ok(),
        LlmProvider::Openrouter => env::var("OPENROUTER_API_KEY").ok(),
        LlmProvider::Gemini => env::var("GEMINI_API_KEY").ok(),
        LlmProvider::Ollama => None,
    }
}

pub fn save_config_to_db(db: &crate::library::db::Database, cfg: &LlmConfig) -> Result<(), String> {
    let json = serde_json::to_string(cfg).map_err(|e| e.to_string())?;
    db.set_setting(SETTINGS_KEY, &json)
}

pub fn load_config_from_db(db: &crate::library::db::Database) -> LlmConfig {
    let stored = db.get_setting(SETTINGS_KEY).ok().flatten();
    load_config(stored.as_deref())
}
