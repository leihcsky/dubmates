"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button-link";
import { StudioClosed } from "@/components/layout/ComingSoon";
import { StudioApp } from "@/components/studio/StudioApp";
import {
  createImportedObjectUrls,
  getImportedPack,
} from "@/lib/db/imported-packs";
import type { ResolvedPack, ResolvedScene } from "@/lib/pack-types";
import { isStudioLocale } from "@/i18n/routing";

export function ImportedPlayClient() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations("import");
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState<ResolvedPack | null>(null);
  const [scene, setScene] = useState<ResolvedScene | null>(null);
  const studioOpen = isStudioLocale(locale);

  useEffect(() => {
    if (!studioOpen) return;
    let revoke: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const id = params.id;
        if (!id) {
          setError(t("missing"));
          return;
        }
        const record = await getImportedPack(id);
        if (!record) {
          setError(t("missing"));
          return;
        }
        const urls = createImportedObjectUrls(record);
        revoke = urls.revoke;
        if (cancelled) {
          urls.revoke();
          return;
        }
        const base = record.pack;
        const baseScene = base.scenes[0];
        if (!baseScene) {
          setError(t("missing"));
          return;
        }
        const resolvedScene: ResolvedScene = {
          ...baseScene,
          videoUrl: urls.videoUrl,
          thumbnailUrl: urls.thumbnailUrl ?? "",
          backingUrl: urls.backingUrl,
          videoMime: record.videoMime,
          promptUrls: urls.promptUrls,
        };
        const resolvedPack: ResolvedPack = {
          ...base,
          thumbnailUrl: urls.thumbnailUrl ?? "",
          scenes: [resolvedScene],
        };
        setPack(resolvedPack);
        setScene(resolvedScene);
      } catch {
        setError(t("failed"));
      }
    })();

    return () => {
      cancelled = true;
      revoke?.();
    };
  }, [params.id, studioOpen, t]);

  if (!studioOpen) {
    return <StudioClosed />;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl">{t("missingTitle")}</h1>
        <p className="mt-3 text-muted">{error}</p>
        <ButtonLink href="/" className="mt-6">
          {t("backHome")}
        </ButtonLink>
      </main>
    );
  }

  if (!pack || !scene) {
    return <div className="px-4 py-16 text-center text-muted">{t("loading")}</div>;
  }

  return <StudioApp pack={pack} scene={scene} />;
}
