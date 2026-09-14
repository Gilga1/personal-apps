import { useEffect, useState } from "react";
import {
  checkYtdlpAvailable,
  ensureYtdlp,
  getIngestJobs,
  ingestYoutube,
  isWebMode,
} from "../../api/stacks";
import { useToastStore } from "../../state/toastStore";
import type { IngestJob, IngestProgressEvent } from "../../types";

interface IngestPanelProps {
  onIngestComplete: () => void;
  onPlaylistImported?: (trackIds: string[]) => void;
}

export function IngestPanel({
  onIngestComplete,
  onPlaylistImported,
}: IngestPanelProps) {
  const [url, setUrl] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [ytdlpOk, setYtdlpOk] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const { push, update, dismiss } = useToastStore();

  const refresh = async () => {
    const [available, list] = await Promise.all([
      checkYtdlpAvailable(),
      getIngestJobs(),
    ]);
    setYtdlpOk(available);
    setJobs(list);
  };

  useEffect(() => {
    (async () => {
      if (!isWebMode()) {
        setPreparing(true);
        try {
          await ensureYtdlp();
        } catch {
          // still check availability below
        } finally {
          setPreparing(false);
        }
      }
      await refresh();
    })();

    if (isWebMode()) {
      const id = setInterval(refresh, 2000);
      return () => clearInterval(id);
    }

    let cancelled = false;
    let unlistenFn: (() => void) | undefined;
    let toastId: string | null = null;

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      if (cancelled) return;
      unlistenFn = await listen<IngestProgressEvent>("ingest-progress", (ev) => {
        const p = ev.payload;
        if (!toastId) {
          toastId = push("Starting YouTube import…", "progress", p.progress);
        } else {
          update(toastId, p.message, "progress", p.progress);
        }
        if (p.status === "done") {
          if (toastId) {
            update(toastId, p.message, "success", 100);
            setTimeout(() => toastId && dismiss(toastId), 4000);
          }
          if (p.track_ids?.length && onPlaylistImported) {
            onPlaylistImported(p.track_ids);
          }
          refresh();
          onIngestComplete();
        }
        if (p.status === "failed") {
          if (toastId) {
            update(toastId, p.message, "error");
            setTimeout(() => toastId && dismiss(toastId), 5000);
          }
          refresh();
        }
      });
    })();

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, [onIngestComplete, onPlaylistImported, push, update, dismiss]);

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      if (!isWebMode()) await ensureYtdlp();
      await ingestYoutube(trimmed, playlistName.trim() || undefined);
      setUrl("");
      await refresh();
    } catch (e) {
      alert(String(e));
    }
  };

  const activeJobs = jobs.filter(
    (j) =>
      j.status === "queued" ||
      j.status === "downloading" ||
      j.status === "normalizing",
  );

  return (
    <div className="ingest-panel">
      <div className="ingest-row">
        <input
          className="nl-input"
          placeholder="Paste YouTube URL (video or playlist)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={!ytdlpOk || preparing}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!ytdlpOk || preparing || !url.trim()}
        >
          Import
        </button>
      </div>
      <div className="ingest-row ingest-playlist-row">
        <input
          className="nl-input"
          placeholder="Playlist name (optional — saves imported tracks)"
          value={playlistName}
          onChange={(e) => setPlaylistName(e.target.value)}
          disabled={!ytdlpOk || preparing}
        />
      </div>
      {preparing && (
        <p className="ingest-hint">Setting up YouTube import…</p>
      )}
      {!preparing && !ytdlpOk && (
        <p className="ingest-warn">
          yt-dlp not available — restart the app to retry setup.
        </p>
      )}
      {activeJobs.length > 0 && (
        <div className="ingest-jobs">
          {activeJobs.map((job) => (
            <div key={job.id} className="ingest-job">
              <div className="ingest-job-head">
                <span className="ingest-status">{job.status}</span>
                <span className="ingest-url">
                  {job.source_url.length > 60
                    ? `${job.source_url.slice(0, 60)}…`
                    : job.source_url}
                </span>
              </div>
              <div className="ingest-bar">
                <div className="ingest-bar-fill" style={{ width: "60%" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
