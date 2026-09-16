import { useEffect, useRef, useState } from "react";
import {
  cancelIngest,
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

type JobProgress = {
  progress: number;
  message: string;
};

export function IngestPanel({
  onIngestComplete,
  onPlaylistImported,
}: IngestPanelProps) {
  const [url, setUrl] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [jobProgress, setJobProgress] = useState<Record<string, JobProgress>>({});
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [ytdlpOk, setYtdlpOk] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const onCompleteRef = useRef(onIngestComplete);
  const onPlaylistRef = useRef(onPlaylistImported);
  onCompleteRef.current = onIngestComplete;
  onPlaylistRef.current = onPlaylistImported;

  const refresh = async () => {
    const [available, list] = await Promise.all([
      checkYtdlpAvailable(),
      getIngestJobs(),
    ]);
    setYtdlpOk(available);
    setJobs(list);
  };

  const handleCancel = async (jobId: string) => {
    setCancellingIds((prev) => new Set(prev).add(jobId));
    try {
      await cancelIngest(jobId);
      setJobProgress((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      await refresh();
    } catch (e) {
      alert(String(e));
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unlistenFn: (() => void) | undefined;
    let toastId: string | null = null;
    let activeJobId: string | null = null;
    const { push, update, dismiss } = useToastStore.getState();

    (async () => {
      if (!isWebMode()) {
        setPreparing(true);
        try {
          await ensureYtdlp();
        } catch {
          // availability check below
        } finally {
          if (!cancelled) setPreparing(false);
        }
      }
      if (!cancelled) await refresh();
    })();

    let intervalId: ReturnType<typeof setInterval> | undefined;

    if (isWebMode()) {
      intervalId = setInterval(refresh, 2000);
    } else {
      (async () => {
        const { listen } = await import("@tauri-apps/api/event");
        if (cancelled) return;
        unlistenFn = await listen<IngestProgressEvent>("ingest-progress", (ev) => {
          const p = ev.payload;
          activeJobId = p.job_id;
          setJobProgress((prev) => ({
            ...prev,
            [p.job_id]: { progress: p.progress, message: p.message },
          }));

          if (!toastId) {
            toastId = push(p.message, "progress", p.progress);
          } else {
            update(toastId, p.message, "progress", p.progress);
          }

          if (p.status === "done") {
            if (toastId) {
              update(toastId, p.message, "success", 100);
              setTimeout(() => toastId && dismiss(toastId), 4000);
              toastId = null;
            }
            if (p.track_ids?.length) {
              onPlaylistRef.current?.(p.track_ids);
            }
            if (activeJobId) {
              setJobProgress((prev) => {
                const next = { ...prev };
                delete next[activeJobId!];
                return next;
              });
            }
            refresh();
            onCompleteRef.current();
          }
          if (p.status === "failed" || p.status === "cancelled") {
            if (toastId) {
              update(
                toastId,
                p.message,
                p.status === "cancelled" ? "success" : "error",
              );
              setTimeout(() => toastId && dismiss(toastId), 5000);
              toastId = null;
            }
            if (activeJobId) {
              setJobProgress((prev) => {
                const next = { ...prev };
                delete next[activeJobId!];
                return next;
              });
            }
            refresh();
          }
        });
      })();
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      unlistenFn?.();
    };
  }, []);

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
      <div className="ingest-row ingest-combined-row">
        <input
          className="nl-input"
          placeholder="Paste YouTube URL (video or playlist)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={!ytdlpOk || preparing}
        />
        <input
          className="search-input ingest-playlist-input"
          placeholder="Playlist name"
          value={playlistName}
          onChange={(e) => setPlaylistName(e.target.value)}
          disabled={!ytdlpOk || preparing}
          title="Optional — saves imported tracks as a playlist"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!ytdlpOk || preparing || !url.trim()}
        >
          Import
        </button>
      </div>
      {preparing && (
        <p className="ingest-hint">Setting up YouTube import (one-time)…</p>
      )}
      {!preparing && !ytdlpOk && (
        <p className="ingest-warn">
          yt-dlp not available — restart the app to retry setup.
        </p>
      )}
      {activeJobs.length > 0 && (
        <div className="ingest-jobs">
          {activeJobs.map((job) => {
            const live = jobProgress[job.id];
            const progress = live?.progress ?? (job.status === "queued" ? 0 : 5);
            const message =
              live?.message ??
              (job.status === "queued"
                ? "Queued…"
                : job.source_url.slice(0, 48));
            const isCancelling = cancellingIds.has(job.id);
            return (
              <div key={job.id} className="ingest-job">
                <div className="ingest-job-head">
                  <span className="ingest-status">{job.status}</span>
                  <span className="ingest-url">{message}</span>
                  <button
                    type="button"
                    className="ingest-cancel-btn"
                    disabled={isCancelling}
                    onClick={() => handleCancel(job.id)}
                  >
                    {isCancelling ? "…" : "Cancel"}
                  </button>
                </div>
                <div className="ingest-bar">
                  <div
                    className="ingest-bar-fill"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
