"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captionDownloadError } from "./caption-download-state";

interface CaptionDownloadProps {
  url?: string;
  extension: "srt" | "vtt";
}

export function CaptionDownload({ url, extension }: CaptionDownloadProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function download() {
    if (!url || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(captionDownloadError(response.status));
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (!blob.size) throw new Error("The caption file is empty. Refresh the link and retry.");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `contentforge-captions.${extension}`;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : "Could not download captions. Please retry.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="space-y-2 text-sm">
      {url ? (
        <button
          type="button"
          className="text-primary font-medium underline disabled:opacity-50"
          disabled={busy || refreshing}
          onClick={() => void download()}
        >
          {busy ? "Downloading captions…" : `Download Captions (${extension.toUpperCase()})`}
        </button>
      ) : (
        <p className="text-muted-foreground">Captions unavailable for this rendered video.</p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {(!url || error || refreshing) && (
        <button
          type="button"
          className="text-primary block underline"
          disabled={busy || refreshing}
          onClick={() => {
            setError("");
            startTransition(() => router.refresh());
          }}
        >
          {refreshing ? "Refreshing caption link…" : "Refresh caption link"}
        </button>
      )}
    </div>
  );
}
