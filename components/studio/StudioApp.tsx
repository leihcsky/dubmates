"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { SceneVideo, type SceneVideoHandle } from "@/components/studio/SceneVideo";
import { WaveformCompare } from "@/components/studio/WaveformCompare";
import { VideoPreviewDialog } from "@/components/media/VideoPreviewDialog";
import { buildSceneAudioTracks } from "@/lib/playback/scene-audio";
import { track } from "@/lib/analytics";
import { recordOnce, requestMicrophone } from "@/lib/audio/recorder";
import { speakLine } from "@/lib/audio/speech";
import { createToneWav } from "@/lib/audio/tone";
import { getTakes, saveTake } from "@/lib/db/takes";
import { downloadBlob, exportDub } from "@/lib/export/render";
import { playDub, type MixHandle } from "@/lib/playback/mix";
import { scoreDub, type DubScoreBreakdown } from "@/lib/scoring/dub-score";
import type { ResolvedPack, ResolvedScene } from "@/lib/pack-types";
import { cn } from "@/lib/utils";

type Phase = "line" | "recording" | "review" | "results";
type DubMode = "follow" | "free";

export function StudioApp({
  pack,
  scene,
  embedded = false,
  onChangePack,
  onImportPack,
  onExit,
  demo = false,
}: {
  pack: ResolvedPack;
  scene: ResolvedScene;
  embedded?: boolean;
  onChangePack?: () => void;
  onImportPack?: () => void;
  onExit?: () => void;
  demo?: boolean;
}) {
  if (embedded) {
    return (
      <StudioAppInner
        pack={pack}
        scene={scene}
        embedded
        onChangePack={onChangePack}
        onImportPack={onImportPack}
        onExit={onExit}
        demo={demo}
      />
    );
  }

  return (
    <Suspense fallback={<div className="px-4 py-10 text-muted">…</div>}>
      <StudioFromSearch
        pack={pack}
        scene={scene}
        onChangePack={onChangePack}
        onImportPack={onImportPack}
        onExit={onExit}
      />
    </Suspense>
  );
}

function StudioFromSearch({
  pack,
  scene,
  onChangePack,
  onImportPack,
  onExit,
}: {
  pack: ResolvedPack;
  scene: ResolvedScene;
  onChangePack?: () => void;
  onImportPack?: () => void;
  onExit?: () => void;
}) {
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  return (
    <StudioAppInner
      pack={pack}
      scene={scene}
      embedded={false}
      onChangePack={onChangePack}
      onImportPack={onImportPack}
      onExit={onExit}
      demo={demo}
    />
  );
}

function StudioAppInner({
  pack,
  scene,
  embedded,
  onChangePack,
  onImportPack,
  onExit,
  demo,
}: {
  pack: ResolvedPack;
  scene: ResolvedScene;
  embedded: boolean;
  onChangePack?: () => void;
  onImportPack?: () => void;
  onExit?: () => void;
  demo: boolean;
}) {
  const t = useTranslations("studio");
  const locale = useLocale();
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<SceneVideoHandle>(null);
  const mixRef = useRef<MixHandle | null>(null);
  const recorderRef = useRef<{ stop: () => void } | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("line");
  const [takes, setTakes] = useState<Record<string, Blob>>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportStage, setExportStage] = useState<"recording" | "converting" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [cachedWebm, setCachedWebm] = useState<{ fileBase: string; blob: Blob } | null>(null);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [waveProgress, setWaveProgress] = useState(0);
  const [score, setScore] = useState<DubScoreBreakdown | null>(null);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [dubMode, setDubMode] = useState<DubMode>("follow");

  const line = scene.lines[index];
  const character = useMemo(
    () => scene.characters.find((item) => item.id === line?.characterId),
    [scene.characters, line],
  );
  const isLast = index + 1 >= scene.lines.length;
  const isFirst = index <= 0;
  const isFree = dubMode === "free";
  const promptUrl = line
    ? (scene.promptUrls?.[line.id] ?? scene.promptUrls?.[line.prompt ?? ""])
    : undefined;
  const waveOriginalUrl = isFree ? undefined : promptUrl;
  const doneCount = scene.lines.filter((item) => takes[item.id]).length;
  // Pack videos are silent; the preview needs the backing bed + original lines.
  const previewAudioTracks = useMemo(() => buildSceneAudioTracks(scene), [scene]);

  useEffect(() => {
    setIndex(0);
    setPhase("line");
    setExportProgress(null);
    setExportStage(null);
    setExportError(null);
    setCachedWebm(null);
    setScore(null);
    setWaveProgress(0);
    setDubMode("follow");
    mixRef.current?.stop();
  }, [pack.id, scene.id]);

  useEffect(() => {
    track("scene_start", { slug: pack.slug, sceneId: scene.id });
    void getTakes(pack.id, scene.id).then((stored) => {
      const blobs: Record<string, Blob> = {};
      for (const [lineId, take] of Object.entries(stored)) {
        blobs[lineId] = take.blob;
      }
      setTakes(blobs);
    });
    return () => {
      mixRef.current?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.id, scene.id]);

  useEffect(() => {
    track("start_game", { slug: pack.slug });
  }, [pack.slug]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (phase !== "results" || isFree) {
      setScore(null);
      setScoreBusy(false);
      return;
    }
    let cancelled = false;
    setScoreBusy(true);
    void scoreDub({ lines: scene.lines, takes }).then((result) => {
      if (!cancelled) {
        setScore(result);
        setScoreBusy(false);
        track("dub_score", {
          slug: pack.slug,
          total: result.total,
          grade: result.grade,
          mode: "follow",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [phase, isFree, scene.lines, takes, pack.slug]);

  async function trackAudioProgress(audio: HTMLAudioElement) {
    setWaveProgress(0);
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        setWaveProgress(1);
        resolve();
      };
      const tick = () => {
        if (done) return;
        const duration = audio.duration;
        if (Number.isFinite(duration) && duration > 0) {
          setWaveProgress(Math.min(1, audio.currentTime / duration));
          if (audio.ended || audio.currentTime >= duration - 0.04) {
            finish();
            return;
          }
        } else if (audio.ended) {
          finish();
          return;
        }
        if (audio.paused && audio.currentTime > 0.08) {
          finish();
          return;
        }
        requestAnimationFrame(tick);
      };
      audio.addEventListener("ended", finish, { once: true });
      tick();
    });
  }

  async function toggleFullscreen() {
    const node = shellRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await node.requestFullscreen();
  }

  /** Drive playhead from the line window on the video (matches original prompt peaks). */
  async function trackVideoLineProgress(
    target: { start: number; end: number },
    options?: { holdWhile?: () => boolean },
  ) {
    const span = Math.max(0.05, target.end - target.start);
    setWaveProgress(0);
    await new Promise<void>((resolve) => {
      const tick = () => {
        const video = videoRef.current;
        if (!video) {
          resolve();
          return;
        }
        const p = Math.min(1, Math.max(0, (video.currentTime - target.start) / span));
        setWaveProgress(p);
        if (video.currentTime >= target.end || p >= 1) {
          setWaveProgress(1);
          if (video.currentTime >= target.end) video.pause();
          if (options?.holdWhile?.()) {
            requestAnimationFrame(tick);
            return;
          }
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  async function seekLine(target = line, withSound = false, options?: { trackProgress?: boolean }) {
    if (!target) return;
    const video = videoRef.current;
    if (!video) return;
    const trackProgress = options?.trackProgress !== false;
    video.muted = !withSound;
    video.currentTime = target.start;
    await video.play();
    const windowMs = Math.max(200, (target.end - target.start) * 1000);
    if (trackProgress) {
      await trackVideoLineProgress(target);
      videoRef.current?.pause();
    } else {
      const started = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (
            !videoRef.current ||
            videoRef.current.currentTime >= target.end ||
            performance.now() - started >= windowMs + 400
          ) {
            videoRef.current?.pause();
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
    }
    videoRef.current?.pause();
  }

  async function hearAgain() {
    if (!line) return;
    setWaveProgress(0);
    // Free mode: preview the scene beat without original dialogue audio.
    if (isFree || !promptUrl) {
      if (!promptUrl && !isFree) {
        speakLine(line.text, locale);
      }
      await seekLine(line, false);
      setWaveProgress(0);
      return;
    }
    const audio = new Audio(promptUrl);
    await new Promise<void>((resolve) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => resolve();
      window.setTimeout(() => resolve(), 120);
    });
    void seekLine(line, false, { trackProgress: false });
    try {
      await audio.play();
    } catch {
      // ignore autoplay/play failures
    }
    await trackAudioProgress(audio);
    audio.pause();
    videoRef.current?.pause();
    setWaveProgress(0);
  }

  function setMode(next: DubMode) {
    if (phase === "recording" || next === dubMode) return;
    setDubMode(next);
    setScore(null);
    setWaveProgress(0);
    track("dub_mode", { slug: pack.slug, mode: next });
  }

  async function startRecording() {
    if (!line) return;
    setMicError(null);
    try {
      const mic = stream ?? (await requestMicrophone());
      if (!stream) {
        setStream(mic);
        track("mic_permission_granted", { slug: pack.slug });
      }
      mixRef.current?.stop();
      window.speechSynthesis?.cancel();
      setWaveProgress(0);
      const video = videoRef.current;
      if (video) {
        video.muted = true;
        video.currentTime = line.start;
        try {
          await video.play();
        } catch {
          // ignore autoplay failures; recording still works
        }
      }
      const maxMs = Math.round((line.end - line.start + 0.7) * 1000);
      const session = recordOnce(mic, maxMs);
      recorderRef.current = session;
      setPhase("recording");
      track("record_start", { lineId: line.id });
      // Playhead follows the line window (same span as original waveform), then holds at 1 for pad.
      void trackVideoLineProgress(line, {
        holdWhile: () => recorderRef.current !== null,
      });
      const blob = await session.done;
      recorderRef.current = null;
      videoRef.current?.pause();
      setWaveProgress(0);
      await saveTake({
        packId: pack.id,
        sceneId: scene.id,
        lineId: line.id,
        blob,
        duration: maxMs / 1000,
        createdAt: Date.now(),
      });
      setTakes((current) => ({ ...current, [line.id]: blob }));
      setPhase("review");
      track("record_complete", { lineId: line.id });
    } catch {
      setMicError(t("micDenied"));
      setPhase("line");
      setWaveProgress(0);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function playTake() {
    if (!line) return;
    const blob = takes[line.id];
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    setWaveProgress(0);
    await new Promise<void>((resolve) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => resolve();
      window.setTimeout(() => resolve(), 120);
    });
    void seekLine(line, false, { trackProgress: false });
    try {
      await audio.play();
    } catch {
      // ignore
    }
    await trackAudioProgress(audio);
    audio.pause();
    videoRef.current?.pause();
    URL.revokeObjectURL(url);
    setWaveProgress(0);
  }

  function goPrev() {
    if (isFirst) return;
    setIndex((value) => value - 1);
    setPhase("line");
    setWaveProgress(0);
  }

  function goNext() {
    if (isLast) {
      setPhase("results");
      setWaveProgress(0);
      track("dub_complete", { slug: pack.slug });
      return;
    }
    setIndex((value) => value + 1);
    setPhase("line");
    setWaveProgress(0);
  }

  async function watchDub() {
    const media = videoRef.current?.media;
    if (!media) return;
    mixRef.current?.stop();
    mixRef.current = await playDub({
      video: media,
      lines: scene.lines,
      takes,
      backingUrl: scene.backingUrl,
    });
    track("watch_dub", { slug: pack.slug });
  }

  const exportFileBase = `dubmates-${pack.slug}-${scene.id}`;

  useEffect(() => {
    setCachedWebm(null);
  }, [takes, scene.id, pack.slug]);

  async function renderWebm(onProgress: (ratio: number) => void) {
    if (cachedWebm?.fileBase === exportFileBase) {
      onProgress(1);
      return cachedWebm.blob;
    }
    const blob = await exportDub({
      videoUrl: scene.videoUrl,
      videoMime: scene.videoMime,
      duration: scene.duration,
      lines: scene.lines,
      takes,
      backingUrl: scene.backingUrl,
      fileBase: exportFileBase,
      onProgress,
    });
    setCachedWebm({ fileBase: exportFileBase, blob });
    return blob;
  }

  async function handleExportWebm() {
    setExportError(null);
    setExportStage("recording");
    setExportProgress(0);
    try {
      const blob = await renderWebm((value) => setExportProgress(Math.round(value * 100)));
      downloadBlob(blob, `${exportFileBase}.webm`);
      setExportProgress(null);
      setExportStage(null);
    } catch {
      setExportError(t("exportError"));
      setExportProgress(null);
      setExportStage(null);
      track("export_failure", { slug: pack.slug, format: "webm" });
    }
  }

  async function handleExportMp4() {
    setExportError(null);
    setExportStage("recording");
    setExportProgress(0);
    let stage: "recording" | "converting" = "recording";
    try {
      const webm = await renderWebm((value) => setExportProgress(Math.round(value * 55)));
      stage = "converting";
      setExportStage("converting");
      const { convertWebmToMp4 } = await import("@/lib/export/to-mp4");
      const mp4 = await convertWebmToMp4(webm, (value) =>
        setExportProgress(55 + Math.round(value * 45)),
      );
      downloadBlob(mp4, `${exportFileBase}.mp4`);
      setExportProgress(null);
      setExportStage(null);
    } catch {
      setExportError(stage === "converting" ? t("exportMp4Error") : t("exportError"));
      setExportProgress(null);
      setExportStage(null);
      track("export_failure", { slug: pack.slug, format: "mp4" });
    }
  }

  function openVideoPreview() {
    if (!scene.videoUrl || phase === "recording") return;
    mixRef.current?.stop();
    window.speechSynthesis?.cancel();
    // Release studio OGV / Web Audio before mounting the preview player.
    videoRef.current?.pause();
    setWaveProgress(0);
    setVideoPreviewOpen(true);
    track("watch_original", { slug: pack.slug });
  }

  function closeVideoPreview() {
    setVideoPreviewOpen(false);
  }

  async function fillTestTakes() {
    const next: Record<string, Blob> = {};
    for (const [lineIndex, item] of scene.lines.entries()) {
      const blob = createToneWav(
        Math.max(0.4, item.end - item.start),
        196 + lineIndex * 40,
      );
      next[item.id] = blob;
      await saveTake({
        packId: pack.id,
        sceneId: scene.id,
        lineId: item.id,
        blob,
        duration: item.end - item.start,
        createdAt: Date.now(),
      });
    }
    setTakes(next);
    setPhase("results");
    track("dub_complete", { slug: pack.slug, demo: true });
  }

  if (!line && phase !== "results") return null;

  return (
    <div className={embedded ? "w-full" : "mx-auto max-w-4xl px-4 py-3 sm:py-4"}>
      <div
        ref={shellRef}
        className={cn(
          "overflow-hidden rounded-[22px] bg-surface card-shadow",
          isFullscreen && "flex h-screen max-h-screen flex-col rounded-none bg-background",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{pack.title}</p>
            <p className="text-[11px] text-muted">
              {t("takesProgress", { done: doneCount, total: scene.lines.length })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onExit ? (
              <Button variant="ghost" size="sm" onClick={onExit}>
                {t("backToStart")}
              </Button>
            ) : null}
            {onChangePack ? (
              <Button variant="ghost" size="sm" onClick={onChangePack}>
                {t("changePack")}
              </Button>
            ) : null}
            {onImportPack ? (
              <Button variant="ghost" size="sm" onClick={onImportPack}>
                {t("importPack")}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={openVideoPreview}
              disabled={!scene.videoUrl || phase === "recording"}
            >
              {t("watchVideo")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void toggleFullscreen()}>
              {isFullscreen ? t("exitFullscreen") : t("fullscreen")}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "relative min-h-0 w-full bg-black",
            // `w-full` matters: without a definite width, `max-h` transfers through
            // `aspect-video` into a max-width and shrinks the frame.
            isFullscreen ? "flex-1" : "aspect-video max-h-[min(42vh,420px)]",
          )}
        >
          {videoPreviewOpen ? (
            <div className="h-full w-full bg-black" aria-hidden />
          ) : (
            <SceneVideo
              key={scene.videoUrl}
              ref={videoRef}
              src={scene.videoUrl}
              mime={scene.videoMime}
              poster={scene.thumbnailUrl || undefined}
              hasAudioTrackHint={scene.videoHasAudio}
              className="h-full w-full"
            />
          )}
          {phase !== "results" && line && !videoPreviewOpen ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pb-3 pt-10">
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/75">
                <span>{t("onClip", { current: index + 1, total: scene.lines.length })}</span>
                <span style={{ color: character?.color }}>{character?.name}</span>
              </div>
              <p className="text-center font-display text-base leading-snug text-white drop-shadow sm:text-lg">
                {isFree ? t("freeCaption") : `« ${line.text} »`}
              </p>
            </div>
          ) : null}
          {phase === "recording" ? (
            <div className="absolute left-3 top-3 rounded-full bg-danger px-2.5 py-0.5 text-[11px] font-bold text-white">
              REC
            </div>
          ) : null}
        </div>

        {phase === "results" ? (
          <div className="shrink-0 space-y-3 border-t border-border bg-surface p-3">
            <WaveformCompare
              compact
              originalUrl={waveOriginalUrl}
              takeBlob={null}
              progress={0}
              className="opacity-80"
            />
            {!isFree ? (
              <div className="flex items-stretch gap-3 rounded-xl bg-surface-2 p-3">
                <div className="flex min-w-[4.5rem] flex-col items-center justify-center rounded-lg bg-surface px-2 py-2">
                  <span className="font-display text-3xl leading-none text-primary">
                    {scoreBusy || !score ? "…" : score.grade}
                  </span>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {t("scoreGrade")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-lg sm:text-xl">{t("scoreTitle")}</h2>
                    <span className="text-sm font-bold text-primary">
                      {scoreBusy || !score ? "—" : `${score.total}/100`}
                    </span>
                  </div>
                  {score ? (
                    <ul className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted">
                      <li>
                        <span className="block font-semibold text-foreground">{score.coverage}%</span>
                        {t("scoreCoverage")}
                      </li>
                      <li>
                        <span className="block font-semibold text-foreground">{score.timing}%</span>
                        {t("scoreTiming")}
                      </li>
                      <li>
                        <span className="block font-semibold text-foreground">{score.energy}%</span>
                        {t("scoreEnergy")}
                      </li>
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted">{t("scoreBusy")}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">{t("freeNoScore")}</p>
            )}
            <h2 className="font-display text-xl">{t("ready")}</h2>
            {exportError ? <p className="text-sm text-danger">{exportError}</p> : null}
            {exportProgress !== null ? (
              <p className="font-semibold text-primary">
                {exportStage === "converting"
                  ? t("converting", { percent: exportProgress })
                  : t("exporting", { percent: exportProgress })}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void watchDub()}>{t("watch")}</Button>
              <Button
                variant="outline"
                onClick={() => void handleExportWebm()}
                disabled={exportProgress !== null}
              >
                {t("export")}
              </Button>
              <Button
                variant="gold"
                onClick={() => void handleExportMp4()}
                disabled={exportProgress !== null}
              >
                {t("exportMp4")}
              </Button>
              {onChangePack ? (
                <Button variant="outline" onClick={onChangePack}>
                  {t("another")}
                </Button>
              ) : (
                <ButtonLink href="/packs" variant="outline">
                  {t("another")}
                </ButtonLink>
              )}
              {onExit ? (
                <Button variant="ghost" onClick={onExit}>
                  {t("backToStart")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="shrink-0 space-y-2.5 border-t border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div
                className="inline-flex rounded-xl bg-surface-2 p-0.5"
                role="group"
                aria-label={t("modeLabel")}
              >
                <button
                  type="button"
                  disabled={phase === "recording"}
                  onClick={() => setMode("follow")}
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold sm:text-xs",
                    !isFree ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
                  )}
                >
                  {t("modeFollow")}
                </button>
                <button
                  type="button"
                  disabled={phase === "recording"}
                  onClick={() => setMode("free")}
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold sm:text-xs",
                    isFree ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
                  )}
                >
                  {t("modeFree")}
                </button>
              </div>
              {isFree ? (
                <p className="min-w-0 truncate text-[10px] text-muted sm:text-[11px]">{t("freeHint")}</p>
              ) : null}
            </div>

            <WaveformCompare
              originalUrl={waveOriginalUrl}
              takeBlob={takes[line.id] ?? null}
              progress={waveProgress}
              liveStream={phase === "recording" ? stream : null}
              recording={phase === "recording"}
            />

            {micError ? <p className="text-xs text-danger">{micError}</p> : null}

            <div className="grid grid-cols-5 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-1 text-[11px] sm:text-xs"
                onClick={() => void hearAgain()}
                disabled={phase === "recording"}
              >
                {isFree ? t("previewScene") : t("hearAgain")}
              </Button>
              {phase === "recording" ? (
                <Button size="sm" className="h-8 px-1 text-[11px] sm:text-xs" onClick={stopRecording}>
                  {t("stop")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-8 px-1 text-[11px] sm:text-xs"
                  onClick={() => void startRecording()}
                >
                  {t("record")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-1 text-[11px] sm:text-xs"
                onClick={() => void playTake()}
                disabled={!takes[line.id] || phase === "recording"}
              >
                {t("playTake")}
              </Button>
              <Button
                variant="surface"
                size="sm"
                className="h-8 px-1 text-[11px] sm:text-xs"
                onClick={goPrev}
                disabled={isFirst || phase === "recording"}
              >
                {t("prev")}
              </Button>
              <Button
                variant="gold"
                size="sm"
                className="h-8 px-1 text-[11px] sm:text-xs"
                onClick={goNext}
                disabled={phase === "recording"}
              >
                {isLast ? t("finish") : t("next")}
              </Button>
            </div>

            <div className="flex gap-1">
              {scene.lines.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Clip ${i + 1}`}
                  onClick={() => {
                    setIndex(i);
                    setPhase("line");
                    setWaveProgress(0);
                  }}
                  className={cn(
                    "h-1 flex-1 cursor-pointer rounded-full",
                    i === index ? "bg-primary" : takes[item.id] ? "bg-sky" : "bg-border",
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {demo ? (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => void fillTestTakes()}>
            Fill test takes
          </Button>
        </div>
      ) : null}

      {videoPreviewOpen && scene.videoUrl ? (
        <VideoPreviewDialog
          title={pack.title}
          videoUrl={scene.videoUrl}
          videoMime={scene.videoMime}
          durationHint={scene.duration}
          audioTracks={previewAudioTracks}
          videoHasAudio={scene.videoHasAudio}
          closeLabel={t("closePreview")}
          onClose={closeVideoPreview}
        />
      ) : null}
    </div>
  );
}
