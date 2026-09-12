"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type SceneVideoHandle = {
  play: () => Promise<void>;
  pause: () => void;
  get currentTime(): number;
  set currentTime(value: number);
  get muted(): boolean;
  set muted(value: boolean);
  get volume(): number;
  set volume(value: number);
  get duration(): number;
  /** `null` while the backend cannot tell yet. Pack videos are sometimes silent. */
  get hasAudioTrack(): boolean | null;
  /** Native video or ogv-compatible media used by mix/export helpers. */
  media: HTMLVideoElement | null;
};

type Props = {
  src: string;
  mime?: string;
  className?: string;
  poster?: string;
  controls?: boolean;
  autoPlay?: boolean;
  /** Start muted (Studio dubbing). Preview should pass false. */
  initialMuted?: boolean;
  /** Known from pack metadata; skips runtime sniffing. */
  hasAudioTrackHint?: boolean;
  /** Fired once the underlying media element is mounted and src is set. */
  onReady?: () => void;
};

type OgvInternals = {
  _audioInfo?: unknown;
  _codec?: { hasAudio?: boolean; loadedMetadata?: boolean } | null;
};

/** `null` means "cannot tell yet" — ogv.js only knows after it reads metadata. */
function sniffOgvAudio(player: HTMLVideoElement | null): boolean | null {
  if (!player) return null;
  const internals = player as unknown as OgvInternals;
  if (internals._codec?.loadedMetadata) return Boolean(internals._codec.hasAudio);
  if (internals._audioInfo != null) return true;
  return null;
}

type AudioSniffable = HTMLVideoElement & {
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
  audioTracks?: { length: number };
};

/** `null` means "cannot tell yet" — never "no audio". */
function sniffNativeAudio(video: HTMLVideoElement | null): boolean | null {
  if (!video) return null;
  const el = video as AudioSniffable;
  if (typeof el.mozHasAudio === "boolean") return el.mozHasAudio;
  if (el.audioTracks && typeof el.audioTracks.length === "number") return el.audioTracks.length > 0;
  // Chrome/Safari only: a zero count may simply mean nothing decoded yet.
  if (typeof el.webkitAudioDecodedByteCount === "number") {
    return el.webkitAudioDecodedByteCount > 0 ? true : null;
  }
  return null;
}

function needsOgv(mime?: string, src?: string) {
  if (mime?.includes("ogg") || mime?.includes("ogv")) return true;
  return Boolean(src?.toLowerCase().includes(".ogv"));
}

function isAbortError(error: unknown) {
  if (!error || typeof error !== "object") {
    return String(error).toLowerCase().includes("abort");
  }
  const err = error as { name?: string; message?: string };
  return err.name === "AbortError" || Boolean(err.message?.toLowerCase().includes("abort"));
}

/** `OGVPlayer.play()` returns nothing, unlike `HTMLMediaElement.play()`. */
function ignoreAbort(result: void | Promise<void>) {
  if (!result || typeof result.then !== "function") return Promise.resolve();
  return result.catch((error: unknown) => {
    if (isAbortError(error)) return;
    throw error;
  });
}

export const SceneVideo = forwardRef<SceneVideoHandle, Props>(function SceneVideo(
  {
    src,
    mime,
    className,
    poster,
    controls = false,
    autoPlay = false,
    initialMuted = true,
    hasAudioTrackHint,
    onReady,
  },
  ref,
) {
  // Derive synchronously — delayed state caused pack switches to mount the wrong backend
  // and collapse the player height.
  const useOgv = needsOgv(mime, src);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const ogvRef = useRef<HTMLVideoElement | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [ogvError, setOgvError] = useState<string | null>(null);

  useEffect(() => {
    if (!useOgv) return;
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isAbortError(event.reason)) return;
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, [useOgv]);

  useEffect(() => {
    if (!useOgv || !hostRef.current) return;
    let cancelled = false;
    let player: HTMLVideoElement | null = null;
    let readyTimer = 0;

    void (async () => {
      try {
        const ogv = await import("ogv");
        ogv.OGVLoader.base = "/ogv";
        if (cancelled || !hostRef.current) return;
        player = new ogv.OGVPlayer({
          wasm: true,
        }) as unknown as HTMLVideoElement;
        // Keep ogv.js's own instance class — it sizes the element through a
        // generated `.ogvjsN` rule that `.ogv-host` CSS then overrides.
        player.classList.add("ogv-surface");
        player.setAttribute("playsinline", "true");
        if (controls) player.setAttribute("controls", "true");
        try {
          // ogv.js throws on these before its audio backend exists, and pack
          // videos have no audio track at all.
          player.muted = initialMuted;
          player.volume = 1;
        } catch {
          // ignore
        }
        player.src = src;
        hostRef.current.replaceChildren(player);
        ogvRef.current = player;
        setOgvError(null);

        let readyOnce = false;
        const notifyReady = () => {
          if (readyOnce || cancelled) return;
          readyOnce = true;
          onReadyRef.current?.();
        };
        player.addEventListener("loadeddata", notifyReady, { once: true });
        player.addEventListener("loadedmetadata", notifyReady, { once: true });
        readyTimer = window.setTimeout(notifyReady, 500);

        if (autoPlay) {
          await ignoreAbort(player.play());
        }
      } catch (error) {
        if (!cancelled && !isAbortError(error)) {
          setOgvError("Impossible de décoder la vidéo OGV dans ce navigateur.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (readyTimer) window.clearTimeout(readyTimer);
      if (player) {
        try {
          player.pause();
        } catch {
          // ignore
        }
        try {
          player.remove();
        } catch {
          // ignore
        }
      }
      ogvRef.current = null;
      if (hostRef.current) hostRef.current.replaceChildren();
    };
  }, [useOgv, src, controls, autoPlay, initialMuted]);

  useImperativeHandle(ref, () => {
    const getMedia = () => (useOgv ? ogvRef.current : videoRef.current);
    return {
      play: async () => {
        const media = getMedia();
        if (!media) return;
        await ignoreAbort(media.play());
      },
      pause: () => {
        try {
          getMedia()?.pause();
        } catch {
          // ignore
        }
      },
      get currentTime() {
        return getMedia()?.currentTime ?? 0;
      },
      set currentTime(value: number) {
        const media = getMedia();
        if (!media) return;
        try {
          media.currentTime = value;
        } catch {
          // ignore seek races
        }
      },
      get muted() {
        try {
          return getMedia()?.muted ?? false;
        } catch {
          return true;
        }
      },
      set muted(value: boolean) {
        const media = getMedia();
        if (!media) return;
        try {
          media.muted = value;
          if (!value) media.volume = 1;
        } catch {
          // ogv.js throws when it has no audio backend.
        }
      },
      get volume() {
        try {
          return getMedia()?.volume ?? 1;
        } catch {
          return 1;
        }
      },
      set volume(value: number) {
        const media = getMedia();
        if (!media) return;
        try {
          media.volume = value;
        } catch {
          // ignore
        }
      },
      get duration() {
        return getMedia()?.duration ?? 0;
      },
      get hasAudioTrack() {
        if (hasAudioTrackHint !== undefined) return hasAudioTrackHint;
        return useOgv ? sniffOgvAudio(ogvRef.current) : sniffNativeAudio(videoRef.current);
      },
      get media() {
        return getMedia();
      },
    };
  }, [useOgv, hasAudioTrackHint]);

  return (
    <div className={cn("relative w-full overflow-hidden bg-black", className)}>
      {useOgv ? (
        <>
          <div ref={hostRef} className="ogv-host absolute inset-0" />
          {ogvError ? (
            <p className="absolute inset-x-0 bottom-0 z-10 bg-black/70 p-3 text-center text-sm text-white">
              {ogvError}
            </p>
          ) : null}
        </>
      ) : (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="h-full w-full object-contain"
          playsInline
          preload="auto"
          controls={controls}
          autoPlay={autoPlay}
          muted={initialMuted}
          onLoadedData={() => onReadyRef.current?.()}
        />
      )}
    </div>
  );
});
