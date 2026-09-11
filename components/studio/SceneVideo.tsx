"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type SceneVideoHandle = {
  play: () => Promise<void>;
  pause: () => void;
  get currentTime(): number;
  set currentTime(value: number);
  get muted(): boolean;
  set muted(value: boolean);
  get duration(): number;
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
};

function needsOgv(mime?: string, src?: string) {
  if (mime?.includes("ogg") || mime?.includes("ogv")) return true;
  return Boolean(src?.toLowerCase().includes(".ogv"));
}

export const SceneVideo = forwardRef<SceneVideoHandle, Props>(function SceneVideo(
  { src, mime, className, poster, controls = false, autoPlay = false },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const ogvRef = useRef<HTMLVideoElement | null>(null);
  const [useOgv, setUseOgv] = useState(false);
  const [ogvError, setOgvError] = useState<string | null>(null);

  useEffect(() => {
    setUseOgv(needsOgv(mime, src));
  }, [mime, src]);

  useEffect(() => {
    if (!useOgv || !hostRef.current) return;
    let cancelled = false;
    let player: HTMLVideoElement | null = null;

    void (async () => {
      try {
        const ogv = await import("ogv");
        ogv.OGVLoader.base = "/ogv";
        if (cancelled || !hostRef.current) return;
        player = new ogv.OGVPlayer({
          wasm: true,
        }) as unknown as HTMLVideoElement;
        player.className = className ?? "aspect-video w-full bg-black";
        player.setAttribute("playsinline", "true");
        if (controls) player.setAttribute("controls", "true");
        player.src = src;
        hostRef.current.replaceChildren(player);
        ogvRef.current = player;
        setOgvError(null);
        if (autoPlay) {
          try {
            await player.play();
          } catch {
            // ignore autoplay blocks
          }
        }
      } catch {
        if (!cancelled) {
          setOgvError("Impossible de décoder la vidéo OGV dans ce navigateur.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (player) {
        try {
          player.pause();
          player.removeAttribute("src");
          player.load?.();
        } catch {
          // ignore
        }
        player.remove();
      }
      ogvRef.current = null;
      if (hostRef.current) hostRef.current.replaceChildren();
    };
  }, [useOgv, src, className, controls, autoPlay]);

  useImperativeHandle(ref, () => {
    const getMedia = () => (useOgv ? ogvRef.current : videoRef.current);
    return {
      play: async () => {
        const media = getMedia();
        if (!media) return;
        await media.play();
      },
      pause: () => getMedia()?.pause(),
      get currentTime() {
        return getMedia()?.currentTime ?? 0;
      },
      set currentTime(value: number) {
        const media = getMedia();
        if (media) media.currentTime = value;
      },
      get muted() {
        return getMedia()?.muted ?? true;
      },
      set muted(value: boolean) {
        const media = getMedia();
        if (media) media.muted = value;
      },
      get duration() {
        return getMedia()?.duration ?? 0;
      },
      get media() {
        return getMedia();
      },
    };
  }, [useOgv]);

  if (useOgv) {
    return (
      <div className="relative">
        <div ref={hostRef} className={className ?? "aspect-video w-full bg-black"} />
        {ogvError ? (
          <p className="absolute inset-x-0 bottom-0 bg-black/70 p-3 text-center text-sm text-white">
            {ogvError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={className ?? "aspect-video w-full bg-black"}
      playsInline
      preload="auto"
      controls={controls}
      autoPlay={autoPlay}
    />
  );
});
