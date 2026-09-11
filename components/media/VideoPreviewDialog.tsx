"use client";

import { useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { SceneVideo } from "@/components/studio/SceneVideo";

function needsOgv(mime?: string, src?: string) {
  if (mime?.includes("ogg") || mime?.includes("ogv")) return true;
  return Boolean(src?.toLowerCase().includes(".ogv"));
}

export function VideoPreviewDialog({
  title,
  videoUrl,
  videoMime,
  closeLabel,
  onClose,
}: {
  title: string;
  videoUrl: string;
  videoMime?: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const useOgv = needsOgv(videoMime, videoUrl);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[24px] bg-surface p-4 card-shadow sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl sm:text-2xl">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
        {useOgv ? (
          <SceneVideo
            src={videoUrl}
            mime={videoMime}
            controls
            autoPlay
            className="aspect-video max-h-[min(70vh,560px)] w-full rounded-[16px] bg-black object-contain"
          />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={videoUrl}
            className="aspect-video max-h-[min(70vh,560px)] w-full rounded-[16px] bg-black object-contain"
            src={videoUrl}
            controls
            autoPlay
            playsInline
          />
        )}
      </div>
    </div>
  );
}
