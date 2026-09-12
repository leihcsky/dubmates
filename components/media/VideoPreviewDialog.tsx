"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneVideo, type SceneVideoHandle } from "@/components/studio/SceneVideo";
import { createSceneAudio, type SceneAudioTrack } from "@/lib/playback/scene-audio";
import { cn } from "@/lib/utils";

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function readDuration(handle: SceneVideoHandle | null, fallback: number) {
  const raw = handle?.duration ?? 0;
  if (Number.isFinite(raw) && raw > 0) return raw;
  return fallback > 0 ? fallback : 0;
}

/**
 * Self-contained preview modal.
 *
 * Most Dub Pack videos carry their own audio, but some ship a silent video with
 * the sound split into `_backing_track` plus one clip per line. When the video
 * turns out to be silent we mix `audioTracks` in and keep it aligned with the
 * picture; otherwise the video plays its own track untouched.
 */
export function VideoPreviewDialog({
  title,
  videoUrl,
  videoMime,
  durationHint,
  audioTracks,
  videoHasAudio,
  closeLabel,
  onClose,
}: {
  title: string;
  videoUrl: string;
  videoMime?: string;
  durationHint?: number;
  audioTracks?: SceneAudioTrack[];
  videoHasAudio?: boolean;
  closeLabel: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const mediaRef = useRef<SceneVideoHandle>(null);
  const hint = durationHint && durationHint > 0 ? durationHint : 0;

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(hint);
  const [mixing, setMixing] = useState(false);
  const seekingRef = useRef(false);
  const mutedRef = useRef(false);
  const mixingRef = useRef(false);
  const startedRef = useRef(false);

  const tracks = useMemo(() => audioTracks ?? [], [audioTracks]);
  const audioRef = useRef<ReturnType<typeof createSceneAudio> | null>(null);

  useEffect(() => {
    const mixer = tracks.length ? createSceneAudio(tracks) : null;
    audioRef.current = mixer;
    return () => {
      audioRef.current = null;
      mixer?.close();
    };
  }, [tracks]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const handle = mediaRef.current;
      if (handle?.media && !seekingRef.current) {
        const t = handle.currentTime;
        if (Number.isFinite(t) && t >= 0) setCurrent(t);
        const d = readDuration(handle, hint);
        if (d > 0) setDuration(d);
        const isPlaying = !handle.media.paused && !handle.media.ended;
        setPlaying(isPlaying);
        if (handle.media.ended) audioRef.current?.stop();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hint]);

  /** `null` while the backend has not read metadata yet. */
  function detectAudio() {
    if (videoHasAudio !== undefined) return videoHasAudio;
    return mediaRef.current?.hasAudioTrack ?? null;
  }

  function startMixer(offset: number) {
    const handle = mediaRef.current;
    if (!handle || tracks.length === 0) return;
    handle.muted = true;
    mixingRef.current = true;
    setMixing(true);
    audioRef.current?.setMuted(mutedRef.current);
    void audioRef.current?.start(offset);
  }

  async function playFrom(offset: number) {
    const handle = mediaRef.current;
    if (!handle?.media) return;

    const silent = detectAudio() === false;
    const useMixer = silent && tracks.length > 0;
    mixingRef.current = useMixer;
    setMixing(useMixer);
    handle.muted = useMixer ? true : mutedRef.current;

    // Avoid a needless ogv.js seek when we are already at the target.
    if (Math.abs(handle.currentTime - offset) > 0.05) {
      try {
        handle.currentTime = offset;
      } catch {
        // ignore seek races
      }
    }

    try {
      await handle.play();
    } catch {
      // Autoplay was refused while audible — retry muted, then restore sound.
      handle.muted = true;
      try {
        await handle.play();
        if (!useMixer && !mutedRef.current) handle.muted = false;
      } catch {
        setPlaying(false);
        return;
      }
    }
    setPlaying(true);

    if (useMixer) {
      audioRef.current?.setMuted(mutedRef.current);
      void audioRef.current?.start(offset);
      return;
    }
    audioRef.current?.stop();

    // Silent videos are only detectable once decoding has begun.
    if (detectAudio() === null && tracks.length > 0) {
      window.setTimeout(() => {
        const current = mediaRef.current;
        if (!current?.media || current.media.paused || mixingRef.current) return;
        if (detectAudio() === false) startMixer(current.currentTime);
      }, 1500);
    }
  }

  function pause() {
    mediaRef.current?.pause();
    audioRef.current?.stop();
    setPlaying(false);
  }

  async function togglePlay() {
    const handle = mediaRef.current;
    if (!handle?.media) return;
    if (!handle.media.paused && !handle.media.ended) {
      pause();
      return;
    }
    const ended = handle.media.ended || (duration > 0 && handle.currentTime >= duration - 0.05);
    await playFrom(ended ? 0 : handle.currentTime);
  }

  function onPlayerReady() {
    if (startedRef.current) return;
    startedRef.current = true;
    void playFrom(0);
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (mixingRef.current) {
      audioRef.current?.setMuted(next);
      return;
    }
    const handle = mediaRef.current;
    if (handle) handle.muted = next;
  }

  function onSeekInput(value: number) {
    seekingRef.current = true;
    setCurrent(value);
    audioRef.current?.stop();
    const handle = mediaRef.current;
    if (handle) {
      try {
        handle.currentTime = value;
      } catch {
        // ignore
      }
    }
  }

  function onSeekEnd() {
    seekingRef.current = false;
    if (playing) void playFrom(current);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === " " || event.key === "k") {
        event.preventDefault();
        void togglePlay();
        return;
      }
      if (event.key === "m") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, duration]);

  const progressMax = duration > 0 ? duration : 1;
  const canSeek = duration > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
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
          <h2 id={titleId} className="min-w-0 truncate font-display text-xl sm:text-2xl">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>

        <div className="overflow-hidden rounded-[16px] bg-black">
          <div
            className="relative w-full cursor-pointer bg-black"
            onClick={() => void togglePlay()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void togglePlay();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={playing ? "Pause" : "Play"}
          >
            <SceneVideo
              ref={mediaRef}
              src={videoUrl}
              mime={videoMime}
              initialMuted={false}
              hasAudioTrackHint={videoHasAudio}
              onReady={onPlayerReady}
              className="pointer-events-none aspect-video max-h-[min(70vh,560px)] w-full"
            />
            {!playing ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white">
                  <Play className="h-7 w-7 translate-x-0.5" />
                </span>
              </div>
            ) : null}
          </div>

          <div className="space-y-2 bg-[#1a1d21] px-3 py-2.5">
            <input
              type="range"
              min={0}
              max={progressMax}
              step={0.05}
              value={canSeek ? Math.min(Math.max(0, current), progressMax) : 0}
              disabled={!canSeek}
              onChange={(event) => onSeekInput(Number(event.target.value))}
              onPointerUp={onSeekEnd}
              onKeyUp={onSeekEnd}
              className={cn(
                "h-1.5 w-full appearance-none rounded-full bg-white/20",
                canSeek ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                "[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5",
                "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
                "[&::-webkit-slider-thumb]:bg-accent",
              )}
              aria-label="Seek"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 px-0 text-white hover:text-accent"
                onClick={() => void togglePlay()}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 px-0 text-white hover:text-accent disabled:opacity-40"
                onClick={toggleMute}
                disabled={!mixing && videoHasAudio === false && tracks.length === 0}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <p className="ml-1 text-xs tabular-nums text-white/80">
                {formatClock(current)} / {formatClock(duration)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
