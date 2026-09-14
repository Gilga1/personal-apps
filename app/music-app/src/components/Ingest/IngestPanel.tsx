import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  checkYtdlpAvailable,
  getIngestJobs,
  ingestYoutube,
} from "../../api/stacks";
import type { IngestJob, IngestProgressEvent } from "../../types";

interface IngestPanelProps {
  onIngestComplete: () => void;
}

export function IngestPanel({ onIngestComplete }: IngestPanelProps) {
  const [url, setUrl] = useState("");
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [ytdlpOk, setYtdlpOk] = useState(true);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const refresh = async () => {
    const [available, list] = await Promise.all([
      checkYtdlpAvailable(),
      getIngestJobs(),
    ]);
    setYtdlpOk(available);
    setJobs(list);
  };

  useEffect(() => {
    refresh();
    const unlisten = listen<IngestProgressEvent>("ingest-progress", (ev) => {
      const { job_id, progress: pct, status } = ev.payload;
      setProgress((p) => ({ ...p, [job_id]: pct }));
      if (status === "done" || status === "failed") {
        refresh();
        if (status === "done") onIngestComplete();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
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
    (j) => j.status === "queued" || j.status === "downloading" || j.status === "normalizing",
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
        <button type="button" onClick={submit} disabled={!ytdlpOk || !url.trim()}>
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
                <div
                  className="ingest-bar-fill"
                  style={{ width: `${progress[job.id] ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
