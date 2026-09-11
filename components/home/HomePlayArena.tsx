"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { StudioApp } from "@/components/studio/StudioApp";
import { track } from "@/lib/analytics";
import {
  createImportedObjectUrls,
  listImportedPacks,
  saveImportedPack,
  type StoredImportedPack,
} from "@/lib/db/imported-packs";
import { PackImportError, parseChoicerPackZip } from "@/lib/import/parse-choicer-pack";
import type { ResolvedPack, ResolvedScene } from "@/lib/pack-types";
import { formatDuration } from "@/lib/utils";

export type CatalogPackOption = {
  slug: string;
  title: string;
  description: string;
  category: string;
  lineCount: number;
  duration: number;
  thumbnailUrl: string;
  pack: ResolvedPack;
};

type ActiveSession = {
  pack: ResolvedPack;
  scene: ResolvedScene;
  revoke?: () => void;
};

type Props = {
  playable: boolean;
  defaultPack: CatalogPackOption | null;
  catalog: CatalogPackOption[];
};

export function HomePlayArena(props: Props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-16 text-muted">…</div>}>
      <HomePlayArenaInner {...props} />
    </Suspense>
  );
}

function HomePlayArenaInner({ playable, defaultPack, catalog }: Props) {
  const t = useTranslations("arena");
  const tImport = useTranslations("import");
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"gate" | "play">("gate");
  const [showPicker, setShowPicker] = useState(false);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [imported, setImported] = useState<StoredImportedPack[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  const refreshImported = useCallback(async () => {
    try {
      setImported(await listImportedPacks());
    } catch {
      setImported([]);
    }
  }, []);

  useEffect(() => {
    void refreshImported();
  }, [refreshImported]);

  useEffect(() => {
    return () => session?.revoke?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startOfficial(option: CatalogPackOption) {
    session?.revoke?.();
    const scene = option.pack.scenes[0];
    if (!scene) return;
    setError(null);
    setStatus(null);
    setShowPicker(false);
    setSession({ pack: option.pack, scene });
    setMode("play");
    track("arena_start_official", { slug: option.slug });
  }

  function backToGate() {
    session?.revoke?.();
    setSession(null);
    setMode("gate");
    setShowPicker(false);
    track("arena_change_pack");
  }

  async function startImported(record: StoredImportedPack) {
    session?.revoke?.();
    const urls = createImportedObjectUrls(record);
    const baseScene = record.pack.scenes[0];
    if (!baseScene) {
      urls.revoke();
      setError(tImport("missing"));
      return;
    }
    const scene: ResolvedScene = {
      ...baseScene,
      videoUrl: urls.videoUrl,
      thumbnailUrl: urls.thumbnailUrl ?? "",
      backingUrl: urls.backingUrl,
      videoMime: record.videoMime,
      promptUrls: urls.promptUrls,
    };
    const pack: ResolvedPack = {
      ...record.pack,
      thumbnailUrl: urls.thumbnailUrl ?? "",
      scenes: [scene],
    };
    setShowPicker(false);
    setSession({ pack, scene, revoke: urls.revoke });
    setMode("play");
    track("arena_start_imported", { id: record.id });
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus(tImport("parsing"));
    track("pack_import_start", { name: file.name, size: file.size });
    try {
      const parsed = await parseChoicerPackZip(file);
      setStatus(tImport("saving"));
      const record = await saveImportedPack(parsed, file.name);
      track("pack_import_success", {
        id: record.id,
        lines: record.pack.scenes[0]?.lines.length ?? 0,
        mime: record.videoMime,
      });
      setStatus(null);
      await refreshImported();
      await startImported(record);
    } catch (err) {
      const message =
        err instanceof PackImportError ? err.message : tImport("failed");
      setError(message);
      setStatus(null);
      track("pack_import_failure", { message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function startSolo() {
    if (!defaultPack) {
      setShowPicker(true);
      return;
    }
    startOfficial(defaultPack);
  }

  useEffect(() => {
    if (!playable || bootstrapped.current) return;
    const wanted = searchParams.get("pack");
    if (!wanted) return;
    const match = catalog.find((item) => item.slug === wanted);
    if (!match) return;
    bootstrapped.current = true;
    startOfficial(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable, catalog, searchParams]);

  if (!playable) {
    return (
      <section id="play" className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-[28px] bg-surface p-8 text-center card-shadow">
          <p className="font-display text-2xl">{t("soonTitle")}</p>
          <p className="mt-3 text-muted">{t("soonBody")}</p>
          <ButtonLink href="/" locale="en" className="mt-6">
            {t("soonCta")}
          </ButtonLink>
        </div>
      </section>
    );
  }

  if (mode === "play" && session) {
    return (
      <section id="play" className="mx-auto max-w-4xl px-4 py-3 sm:py-4">
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <StudioApp
          pack={session.pack}
          scene={session.scene}
          embedded
          onChangePack={() => setShowPicker(true)}
          onImportPack={() => inputRef.current?.click()}
          onExit={backToGate}
        />
        {showPicker ? (
          <PackPickerSheet
            t={t}
            tImport={tImport}
            catalog={catalog}
            imported={imported}
            busy={busy}
            error={error}
            status={status}
            onClose={() => setShowPicker(false)}
            onPickOfficial={startOfficial}
            onPickImported={(item) => void startImported(item)}
            onImport={() => inputRef.current?.click()}
            onExit={backToGate}
          />
        ) : null}
      </section>
    );
  }

  const poster = defaultPack?.thumbnailUrl || defaultPack?.pack.scenes[0]?.thumbnailUrl;

  return (
    <section id="play" className="mx-auto max-w-4xl px-4 py-3 sm:py-4">
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div className="overflow-hidden rounded-[22px] bg-surface card-shadow">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {defaultPack?.title ?? "Dubmates"}
            </p>
            <p className="text-[11px] text-muted">
              {defaultPack
                ? `${defaultPack.lineCount} clips · ${formatDuration(defaultPack.duration)}`
                : t("gateSubtitle")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setShowPicker(true)}>
              {t("choosePack")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? tImport("busy") : t("importCta")}
            </Button>
          </div>
        </div>

        <div className="relative max-h-[min(42vh,420px)] bg-black">
          {defaultPack?.pack.scenes[0]?.videoUrl ? (
            <video
              className="aspect-video max-h-[min(42vh,420px)] h-full w-full bg-black object-contain opacity-90"
              src={defaultPack.pack.scenes[0].videoUrl}
              poster={poster || undefined}
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
            />
          ) : (
            <div className="flex aspect-video max-h-[min(42vh,420px)] items-center justify-center text-muted">
              Dubmates
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 px-4 text-center">
            <p className="font-display text-3xl text-white sm:text-4xl">Dubmates</p>
            <p className="mt-2 max-w-md text-sm text-white/85">{t("gateSubtitle")}</p>
            <Button size="xl" className="mt-5 min-w-40" onClick={startSolo}>
              {t("play")}
            </Button>
            <p className="mt-3 text-xs text-white/75">{t("soloHint")}</p>
          </div>
        </div>

        <div className="space-y-2.5 border-t border-border bg-surface p-3">
          <div className="flex min-h-7 items-center rounded-xl bg-surface-2 px-2.5 py-1.5 sm:min-h-8">
            <p className="text-[11px] leading-snug text-muted sm:text-xs">
              {t.rich("findPacks", {
                gamebanana: (chunks) => (
                  <a
                    href="https://gamebanana.com/mods/cats/44064"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    {chunks}
                  </a>
                ),
                choicer: (chunks) => (
                  <a
                    href="https://choicervoicer.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
              {t("choosePack")}
            </Button>
            <Button
              variant="sky"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? tImport("busy") : t("importCta")}
            </Button>
            <ButtonLink href="/packs" variant="ghost" size="sm">
              {t("browsePacks")}
            </ButtonLink>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {status ? <p className="text-sm text-muted">{status}</p> : null}
        </div>
      </div>

      {showPicker ? (
        <PackPickerSheet
          t={t}
          tImport={tImport}
          catalog={catalog}
          imported={imported}
          busy={busy}
          error={error}
          status={status}
          onClose={() => setShowPicker(false)}
          onPickOfficial={startOfficial}
          onPickImported={(item) => void startImported(item)}
          onImport={() => inputRef.current?.click()}
        />
      ) : null}
    </section>
  );
}

function PackPickerSheet({
  t,
  tImport,
  catalog,
  imported,
  busy,
  error,
  status,
  onClose,
  onPickOfficial,
  onPickImported,
  onImport,
  onExit,
}: {
  t: ReturnType<typeof useTranslations>;
  tImport: ReturnType<typeof useTranslations>;
  catalog: CatalogPackOption[];
  imported: StoredImportedPack[];
  busy: boolean;
  error: string | null;
  status: string | null;
  onClose: () => void;
  onPickOfficial: (item: CatalogPackOption) => void;
  onPickImported: (item: StoredImportedPack) => void;
  onImport: () => void;
  onExit?: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-surface p-5 card-shadow"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{t("pickerTitle")}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
        <ul className="mt-4 space-y-2">
          {catalog.map((item) => (
            <li key={item.slug}>
              <button
                type="button"
                onClick={() => onPickOfficial(item)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-left hover:border-primary"
              >
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="text-xs text-muted">
                    {item.lineCount} clips · {formatDuration(item.duration)}
                  </span>
                </span>
                <span className="text-sm font-bold text-primary">{t("play")}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-sm font-semibold">{t("importLabel")}</p>
          <p className="mt-1 text-xs text-muted">{t("importHint")}</p>
          <Button className="mt-3" variant="sky" disabled={busy} onClick={onImport}>
            {busy ? tImport("busy") : t("importCta")}
          </Button>
          {status ? <p className="mt-2 text-sm text-muted">{status}</p> : null}
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          {imported.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {imported.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPickImported(item)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block font-semibold">{item.pack.title}</span>
                      <span className="text-xs text-muted">
                        {item.pack.scenes[0]?.lines.length ?? 0} clips
                      </span>
                    </span>
                    <span className="text-sm font-bold text-primary">{t("play")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {onExit ? (
          <Button className="mt-5 w-full" variant="outline" onClick={onExit}>
            {t("backToStart")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
