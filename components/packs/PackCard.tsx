"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { VideoPreviewDialog } from "@/components/media/VideoPreviewDialog";
import { formatDuration, packAssetUrl } from "@/lib/utils";
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
  const previewScene = pack.scenes.find((scene) => Boolean(scene.video));
  const previewUrl = previewScene?.video
    ? packAssetUrl(pack.slug, previewScene.video)
    : null;
  const thumbnailUrl = pack.thumbnail
    ? packAssetUrl(pack.slug, pack.thumbnail)
    : null;
  const canPreview = Boolean(previewUrl);

  return (
    <>
      <article className="flex h-full flex-col overflow-hidden rounded-[18px] bg-surface p-2.5 card-shadow">
        <div className="relative aspect-video shrink-0 overflow-hidden rounded-[14px] bg-surface-2">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
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
        <div className="flex flex-1 flex-col gap-3 p-3">
          <p className="text-xs uppercase tracking-wide text-muted">{pack.category}</p>
          <h3 className="font-display text-xl">{pack.title}</h3>
          <p className="text-sm text-muted">
            {formatDuration(getPackDuration(pack))} ·{" "}
            {t("sceneCount", { count: pack.scenes.length })}
          </p>
          {canPlay ? (
            <div className="mt-auto flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                disabled={!canPreview}
                onClick={() => setPreviewOpen(true)}
              >
                {t("preview")}
              </Button>
              <ButtonLink href={`/?pack=${pack.slug}`} className="w-full sm:flex-1">
                {t("playPack")}
              </ButtonLink>
            </div>
          ) : (
            <Button disabled className="mt-auto w-full" variant="surface">
              {t("comingSoon")}
            </Button>
          )}
        </div>
      </article>

      {previewOpen && previewUrl ? (
        <VideoPreviewDialog
          title={pack.title}
          videoUrl={previewUrl}
          closeLabel={t("close")}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
