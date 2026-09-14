use super::config::{LlmConfig, LlmProvider};
use serde_json::Value;
use std::time::Duration;

const SYSTEM_PROMPT: &str =
    "You are a music metadata assistant. Return valid JSON only, no markdown or prose.";

pub struct LlmClient {
    config: LlmConfig,
    http: reqwest::Client,
}

impl LlmClient {
    pub fn new(config: LlmConfig) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self { config, http }
    }

    pub async fn complete_json(&self, user_prompt: &str) -> Result<String, String> {
        match self.config.provider {
            LlmProvider::Ollama => self.complete_ollama(user_prompt).await,
            LlmProvider::Openai => self.complete_openai_compatible(user_prompt, false).await,
            LlmProvider::Openrouter => self.complete_openai_compatible(user_prompt, true).await,
            LlmProvider::Gemini => self.complete_gemini(user_prompt).await,
        }
    }

    pub async fn test_connection(&self) -> Result<String, String> {
        let response = self
            .complete_json("Reply with JSON: {\"status\":\"ok\"}")
            .await?;
        if response.contains("ok") {
            Ok(format!(
                "Connected to {} ({})",
                self.config.provider.as_str(),
                self.config.model
            ))
        } else {
            Ok(format!(
                "Provider responded ({} / {})",
                self.config.provider.as_str(),
                self.config.model
            ))
        }
    }

    async fn complete_ollama(&self, user_prompt: &str) -> Result<String, String> {
        let host = self
            .config
            .ollama_host
            .as_deref()
            .unwrap_or("http://localhost:11434");
        let url = format!("{}/api/chat", host.trim_end_matches('/'));

        let body = serde_json::json!({
            "model": self.config.model,
            "stream": false,
            "format": "json",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ]
        });

        let resp = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {e}"))?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama error: {text}"));
        }

        let json: Value = resp.json().await.map_err(|e| e.to_string())?;
        extract_message_content(&json)
    }

    async fn complete_openai_compatible(
        &self,
        user_prompt: &str,
        is_openrouter: bool,
    ) -> Result<String, String> {
        let api_key = self
            .config
            .api_key
            .clone()
            .filter(|k| !k.is_empty())
            .ok_or_else(|| {
                if is_openrouter {
                    "Missing OPENROUTER_API_KEY or api_key in config".to_string()
                } else {
                    "Missing OPENAI_API_KEY or api_key in config".to_string()
                }
            })?;

        let default_url = if is_openrouter {
            "https://openrouter.ai/api/v1/chat/completions"
        } else {
            "https://api.openai.com/v1/chat/completions"
        };
        let url = self
            .config
            .base_url
            .clone()
            .unwrap_or_else(|| default_url.to_string());

        let body = serde_json::json!({
            "model": self.config.model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ]
        });

        let mut req = self.http.post(&url).bearer_auth(api_key).json(&body);
        if is_openrouter {
            req = req.header("HTTP-Referer", "https://stacks.local").header(
                "X-Title",
                "Stacks Music Player",
            );
        }

        let resp = req
            .send()
            .await
            .map_err(|e| format!("API request failed: {e}"))?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("API error: {text}"));
        }

        let json: Value = resp.json().await.map_err(|e| e.to_string())?;
        extract_openai_content(&json)
    }

    async fn complete_gemini(&self, user_prompt: &str) -> Result<String, String> {
        let api_key = self
            .config
            .api_key
            .clone()
            .filter(|k| !k.is_empty())
            .ok_or_else(|| "Missing GEMINI_API_KEY or api_key in config".to_string())?;

        let base = self
            .config
            .base_url
            .clone()
            .unwrap_or_else(|| "https://generativelanguage.googleapis.com".to_string());
        let url = format!(
            "{}/v1beta/models/{}:generateContent?key={}",
            base.trim_end_matches('/'),
            self.config.model,
            api_key
        );

        let body = serde_json::json!({
            "contents": [{
                "parts": [{
                    "text": format!("{}\n\n{}", SYSTEM_PROMPT, user_prompt)
                }]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        });

        let resp = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Gemini request failed: {e}"))?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Gemini error: {text}"));
        }

        let json: Value = resp.json().await.map_err(|e| e.to_string())?;
        extract_gemini_content(&json)
    }
}

fn extract_message_content(json: &Value) -> Result<String, String> {
    json["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Missing Ollama response content".to_string())
}

fn extract_openai_content(json: &Value) -> Result<String, String> {
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Missing API response content".to_string())
}

fn extract_gemini_content(json: &Value) -> Result<String, String> {
    json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Missing Gemini response content".to_string())
}

pub fn extract_json_object(text: &str) -> Result<Value, String> {
    let trimmed = text.trim();
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        return Ok(v);
    }
    let start = trimmed.find('{').ok_or("No JSON object in response")?;
    let end = trimmed.rfind('}').ok_or("No JSON object in response")?;
    serde_json::from_str(&trimmed[start..=end]).map_err(|e| e.to_string())
}
