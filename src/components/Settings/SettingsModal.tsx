import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  getLlmConfig,
  getUseLlmRerank,
  listLlmProviders,
  normalizeLowConfidence,
  setLlmConfig,
  setUseLlmRerank,
  testLlmConnection,
} from "../../api/stacks";
import { useSettingsStore } from "../../state/settingsStore";
import { useToastStore } from "../../state/toastStore";
import type { EnrichProgressEvent, LlmConfig, LlmProvider } from "../../types";

export function SettingsModal() {
  const {
    settingsOpen,
    setSettingsOpen,
    providers,
    setProviders,
    setLlmConfig: storeLlmConfig,
    useLlmRerank,
    setUseLlmRerank: storeSetUseLlmRerank,
  } = useSettingsStore();
  const { push, update, dismiss } = useToastStore();
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!settingsOpen) return;
    (async () => {
      const [cfg, prov, rerank] = await Promise.all([
        getLlmConfig(),
        listLlmProviders(),
        getUseLlmRerank(),
      ]);
      setConfig(cfg);
      storeLlmConfig(cfg);
      setProviders(prov);
      storeSetUseLlmRerank(rerank);
    })();
  }, [settingsOpen, storeLlmConfig, setProviders, storeSetUseLlmRerank]);

  useEffect(() => {
    if (!settingsOpen) return;
    let unlisten: (() => void) | undefined;
    let toastId: string | null = null;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<EnrichProgressEvent>("enrich-progress", (ev) => {
        const p = ev.payload;
        const pct = p.total ? (p.current / p.total) * 100 : 0;
        if (!toastId) {
          toastId = push("Enriching low-confidence tracks…", "progress", pct);
        } else {
          update(toastId, p.message, "progress", pct);
        }
      });
    })();
    return () => unlisten?.();
  }, [settingsOpen, push, update]);

  const currentProvider = config
    ? providers.find((p) => p.id === config.provider)
    : undefined;

  const save = async () => {
    if (!config) return;
    await setLlmConfig(config);
    storeLlmConfig(config);
    setStatus("Settings saved.");
  };

  const test = async () => {
    if (!config) return;
    setStatus("Testing connection…");
    try {
      await setLlmConfig(config);
      const msg = await testLlmConnection();
      setStatus(msg);
    } catch (e) {
      setStatus(String(e));
    }
  };

  const enrich = async () => {
    const toastId = push("Enriching low-confidence tracks…", "progress", 0);
    setStatus("Enriching low-confidence tracks…");
    try {
      const count = await normalizeLowConfidence();
      const msg = `Enriched ${count} track(s).`;
      setStatus(msg);
      update(toastId, msg, "success", 100);
      setTimeout(() => dismiss(toastId), 4000);
    } catch (e) {
      const msg = String(e);
      setStatus(msg);
      update(toastId, msg, "error");
      setTimeout(() => dismiss(toastId), 5000);
    }
  };

  return (
    <AnimatePresence>
      {settingsOpen && config && (
    <motion.div
      className="modal-backdrop"
      onClick={() => setSettingsOpen(false)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.25 }}
      >
        <h2>LLM settings</h2>
        <p className="modal-sub">
          Configure OpenRouter, OpenAI, Gemini, or a local Ollama model (including
          small 2B models like gemma2:2b).
        </p>

        <label>
          Provider
          <select
            value={config.provider}
            onChange={(e) => {
              const provider = e.target.value as LlmProvider;
              const models =
                providers.find((p) => p.id === provider)?.models ?? [];
              setConfig({
                ...config,
                provider,
                model: models[0] ?? config.model,
              });
            }}
          >
            <option value="ollama">Ollama (local)</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </label>

        <label>
          Model
          <input
            list="model-suggestions"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder="e.g. llama3.2:3b or google/gemma-2-2b-it"
          />
          <datalist id="model-suggestions">
            {(currentProvider?.models ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        {config.provider !== "ollama" && (
          <label>
            API key
            <input
              type="password"
              value={config.api_key ?? ""}
              onChange={(e) =>
                setConfig({ ...config, api_key: e.target.value })
              }
              placeholder="Or set OPENAI_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY"
            />
          </label>
        )}

        {config.provider === "ollama" && (
          <label>
            Ollama host
            <input
              value={config.ollama_host ?? "http://localhost:11434"}
              onChange={(e) =>
                setConfig({ ...config, ollama_host: e.target.value })
              }
            />
          </label>
        )}

        <label>
          Base URL override (optional)
          <input
            value={config.base_url ?? ""}
            onChange={(e) =>
              setConfig({ ...config, base_url: e.target.value || null })
            }
            placeholder="Custom API endpoint"
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={useLlmRerank}
            onChange={async (e) => {
              const enabled = e.target.checked;
              storeSetUseLlmRerank(enabled);
              await setUseLlmRerank(enabled);
            }}
          />
          Use LLM for playlist re-ranking
        </label>

        <div className="modal-actions">
          <button type="button" className="file-btn" onClick={test}>
            Test connection
          </button>
          <button type="button" className="file-btn" onClick={enrich}>
            Enrich filename matches
          </button>
          <button type="button" className="primary-btn" onClick={save}>
            Save
          </button>
        </div>

        {status && <p className="modal-status">{status}</p>}
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useLlmRerankEnabled() {
  return true;
}
