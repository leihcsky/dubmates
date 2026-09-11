"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import {
  listImportedPacks,
  saveImportedPack,
  type StoredImportedPack,
} from "@/lib/db/imported-packs";
import { PackImportError, parseChoicerPackZip } from "@/lib/import/parse-choicer-pack";

export function PackImporter() {
  const t = useTranslations("import");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [imported, setImported] = useState<StoredImportedPack[]>([]);

  const refresh = useCallback(async () => {
    try {
      setImported(await listImportedPacks());
    } catch {
      setImported([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus(t("parsing"));
    track("pack_import_start", { name: file.name, size: file.size });
    try {
      const parsed = await parseChoicerPackZip(file);
      setStatus(t("saving"));
      const record = await saveImportedPack(parsed, file.name);
      track("pack_import_success", {
        id: record.id,
        lines: record.pack.scenes[0]?.lines.length ?? 0,
        mime: record.videoMime,
      });
      setStatus(t("ready", { title: record.pack.title }));
      await refresh();
      router.push(`/play/import/${record.id}`);
    } catch (err) {
      const message =
        err instanceof PackImportError
          ? err.message
          : t("failed");
      setError(message);
      setStatus(null);
      track("pack_import_failure", { message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section id="import-pack" className="mx-auto max-w-6xl px-4 py-10">
      <article className="rounded-[28px] bg-surface p-6 card-shadow sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">{t("badge")}</p>
        <h2 className="mt-2 font-display text-3xl">{t("title")}</h2>
        <p className="mt-3 max-w-3xl text-muted">{t("body")}</p>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a
            className="font-semibold text-sky underline-offset-2 hover:underline"
            href="https://gamebanana.com/games/17471"
            target="_blank"
            rel="noreferrer"
          >
            GameBanana
          </a>
          <a
            className="font-semibold text-sky underline-offset-2 hover:underline"
            href="https://choicervoicer.com/"
            target="_blank"
            rel="noreferrer"
          >
            choicervoicer.com
          </a>
        </div>
        <p className="mt-3 text-sm text-muted">{t("tip")}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button
            size="lg"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t("busy") : t("cta")}
          </Button>
          {status ? <p className="text-sm text-muted">{status}</p> : null}
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <p className="mt-4 text-xs text-muted">{t("privacy")}</p>

        {imported.length > 0 ? (
          <div className="mt-8 border-t border-border pt-6">
            <h3 className="font-display text-xl">{t("recentTitle")}</h3>
            <ul className="mt-4 space-y-3">
              {imported.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{item.pack.title}</p>
                    <p className="text-xs text-muted">
                      {item.pack.scenes[0]?.lines.length ?? 0} clips · {item.sourceName}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/play/import/${item.id}`)}
                  >
                    {t("play")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
    </section>
  );
}
