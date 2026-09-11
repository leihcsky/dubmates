"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { getPackDuration, isPackPlayable } from "@/lib/packs";
import type { DubPack } from "@/lib/pack-types";

export function PackCard({
  pack,
  playable,
}: {
  pack: DubPack;
  playable: boolean;
}) {
  const t = useTranslations("packs");
  const canPlay = playable && isPackPlayable(pack);
  const [previewOpen, setPreviewOpen] = useState(false);
  const titleId = useId();
  const previewScene = pack.scenes.find((scene) => Boolean(scene.video));
  const previewUrl = previewScene
    ? `/packs/${pack.slug}/${previewScene.video}`
    : null;
  const canPreview = Boolean(previewUrl);

  return (
    <>
      <article className="overflow-hidden rounded-[18px] bg-surface p-2.5 card-shadow">
        <div className="relative aspect-video overflow-hidden rounded-[14px] bg-surface-2">
          {pack.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/packs/${pack.slug}/${pack.thumbnail}`}
              alt={pack.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">
              {t("comingSoon")}
            </div>
          )}
          {pack.comingSoon ? (
            <span className="absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-foreground">
              {t("comingSoon")}
            </span>
          ) : null}
        </div>
        <div className="space-y-3 p-3">
          <p className="text-xs uppercase tracking-wide text-muted">{pack.category}</p>
          <h3 className="font-display text-xl">{pack.title}</h3>
          <p className="text-sm text-muted">
            {formatDuration(getPackDuration(pack))} ·{" "}
            {t("sceneCount", { count: pack.scenes.length })}
          </p>
          {canPlay ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                disabled={!canPreview}
                onClick={() => setPreviewOpen(true)}
              >
                {t("preview")}
              </Button>
              <Button asChild className="w-full sm:flex-1">
                <Link href={`/?pack=${pack.slug}`}>{t("playPack")}</Link>
              </Button>
            </div>
          ) : (
            <Button disabled className="w-full" variant="surface">
              {t("comingSoon")}
            </Button>
          )}
        </div>
      </article>

      {previewOpen && previewUrl ? (
        <PackPreviewDialog
          title={pack.title}
          titleId={titleId}
          videoUrl={previewUrl}
          closeLabel={t("close")}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}

function PackPreviewDialog({
  title,
  titleId,
  videoUrl,
  closeLabel,
  onClose,
}: {
  title: string;
  titleId: string;
  videoUrl: string;
  closeLabel: string;
  onClose: () => void;
}) {
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
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          key={videoUrl}
          className="aspect-video max-h-[min(70vh,560px)] w-full rounded-[16px] bg-black object-contain"
          src={videoUrl}
          controls
          autoPlay
          playsInline
        />
      </div>
    </div>
  );
}
