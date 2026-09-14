import { useEffect, useState } from "react";
import {
  checkYtdlpAvailable,
  getIngestJobs,
  ingestYoutube,
  isWebMode,
} from "../../api/stacks";
import type { IngestJob } from "../../types";

interface IngestPanelProps {
  onIngestComplete: () => void;
}

export function IngestPanel({ onIngestComplete }: IngestPanelProps) {
  const [url, setUrl] = useState("");
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [ytdlpOk, setYtdlpOk] = useState(true);

  const refresh = async () => {
    const [available, list] = await Promise.all([
      checkYtdlpAvailable(),
      getIngestJobs(),
    ]);
    setYtdlpOk(available);
    const prevActive = jobs.some(
      (j) =>
        j.status === "queued" ||
        j.status === "downloading" ||
        j.status === "normalizing",
    );
    const nowDone = list.some((j) => j.status === "done");
    setJobs(list);
    if (prevActive && nowDone) onIngestComplete();
  };

  useEffect(() => {
    refresh();
    if (isWebMode()) {
      const id = setInterval(refresh, 2000);
      return () => clearInterval(id);
    }

    let cancelled = false;
    let unlistenFn: (() => void) | undefined;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      if (cancelled) return;
      unlistenFn = await listen<{
        job_id: string;
        status: string;
        progress: number;
      }>("ingest-progress", (ev) => {
        if (ev.payload.status === "done" || ev.payload.status === "failed") {
          refresh();
          if (ev.payload.status === "done") onIngestComplete();
        }
      });
    })();
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onIngestComplete]);

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      await ingestYoutube(trimmed);
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
          disabled={!ytdlpOk}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!ytdlpOk || !url.trim()}
        >
          Import
        </button>
      </div>
      {!ytdlpOk && (
        <p className="ingest-warn">
          yt-dlp not found — install it to import from YouTube.
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
