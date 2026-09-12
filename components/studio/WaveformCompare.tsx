"use client";

import { useEffect, useRef } from "react";
import { loadArrayBuffer } from "@/lib/playback/scene-audio";
import { cn } from "@/lib/utils";

type Props = {
  originalUrl?: string;
  takeBlob?: Blob | null;
  /** 0–1 playhead driven by real audio/recording time. */
  progress?: number;
  liveStream?: MediaStream | null;
  recording?: boolean;
  compact?: boolean;
  className?: string;
};

const BAR_COUNT = 64;

async function peaksFromUrl(url: string, bars: number) {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await loadArrayBuffer(url));
    return samplePeaks(buffer, bars);
  } finally {
    await ctx.close();
  }
}

async function peaksFromBlob(blob: Blob, bars: number) {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    return samplePeaks(buffer, bars);
  } finally {
    await ctx.close();
  }
}

function samplePeaks(buffer: AudioBuffer, bars: number) {
  const data = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / bars));
  const peaks: number[] = [];
  for (let i = 0; i < bars; i += 1) {
    let max = 0;
    const start = i * block;
    const end = Math.min(data.length, start + block);
    for (let j = start; j < end; j += 1) {
      max = Math.max(max, Math.abs(data[j] ?? 0));
    }
    peaks.push(max);
  }
  const peak = Math.max(...peaks, 0.001);
  return peaks.map((value) => Math.min(1, value / peak));
}

function draw(
  canvas: HTMLCanvasElement,
  original: number[],
  take: number[],
  liveLevel: number,
  progress: number,
  recording: boolean,
) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const mid = height / 2;
  const bars = Math.max(original.length, take.length, BAR_COUNT);
  const gap = 1;
  const barW = Math.max(1, (width - gap * bars) / bars);
  const clamped = Math.min(1, Math.max(0, progress));
  const playIndex = Math.min(bars - 1, Math.floor(clamped * bars));

  for (let i = 0; i < bars; i += 1) {
    const o = original[i] ?? 0.1;
    const x = i * (barW + gap);
    const oh = Math.max(1.5, o * (height * 0.38));
    const behind = clamped > 0 && i <= playIndex;
    ctx.fillStyle = behind ? "rgba(217, 100, 91, 0.45)" : "rgba(90, 95, 102, 0.28)";
    ctx.fillRect(x, mid - oh, barW, oh * 2);

    const t = take[i] ?? 0;
    if (!recording && t > 0.02) {
      const th = Math.max(1.5, t * (height * 0.4));
      const takeBehind = clamped > 0 && i <= playIndex;
      ctx.fillStyle = takeBehind ? "rgba(127, 184, 221, 0.95)" : "rgba(127, 184, 221, 0.35)";
      ctx.fillRect(x, mid - th, barW, th * 2);
    }
  }

  // During recording: paint a growing take trail + live spike at the playhead.
  if (recording && clamped > 0) {
    for (let i = 0; i <= playIndex; i += 1) {
      const trail = take[i] ?? 0;
      if (trail <= 0.02) continue;
      const x = i * (barW + gap);
      const th = Math.max(1.5, trail * (height * 0.4));
      ctx.fillStyle = "rgba(217, 100, 91, 0.75)";
      ctx.fillRect(x, mid - th, barW, th * 2);
    }
    const x = playIndex * (barW + gap);
    const liveH = Math.max(2, Math.min(1, liveLevel) * (height * 0.48));
    ctx.fillStyle = "#D9645B";
    ctx.fillRect(x, mid - liveH, Math.max(barW, 2), liveH * 2);
  }

  if (clamped > 0 && clamped < 1) {
    const x = clamped * width;
    ctx.strokeStyle = "#D9645B";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 1);
    ctx.lineTo(x, height - 1);
    ctx.stroke();
  }
}

export function WaveformCompare({
  originalUrl,
  takeBlob,
  progress = 0,
  liveStream = null,
  recording = false,
  compact = false,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<number[]>([]);
  const takeRef = useRef<number[]>([]);
  const recordedTrailRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => 0));
  const liveLevelRef = useRef(0);
  const progressRef = useRef(progress);
  const recordingRef = useRef(recording);

  progressRef.current = progress;
  recordingRef.current = recording;

  function redraw() {
    if (!canvasRef.current) return;
    const trail = recordingRef.current ? recordedTrailRef.current : takeRef.current;
    draw(
      canvasRef.current,
      originalRef.current,
      trail,
      liveLevelRef.current,
      progressRef.current,
      recordingRef.current,
    );
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!originalUrl) {
        originalRef.current = Array.from({ length: BAR_COUNT }, () => 0.12);
      } else {
        try {
          originalRef.current = await peaksFromUrl(originalUrl, BAR_COUNT);
        } catch {
          originalRef.current = Array.from({ length: BAR_COUNT }, (_, i) => 0.12 + (i % 4) * 0.04);
        }
      }
      if (!cancelled) redraw();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!takeBlob) {
        takeRef.current = [];
      } else {
        try {
          takeRef.current = await peaksFromBlob(takeBlob, BAR_COUNT);
        } catch {
          takeRef.current = [];
        }
      }
      if (!cancelled) redraw();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeBlob]);

  useEffect(() => {
    if (recording) {
      recordedTrailRef.current = Array.from({ length: BAR_COUNT }, () => 0);
    }
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, recording]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!liveStream || !recording) {
      liveLevelRef.current = 0;
      redraw();
      return;
    }

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(liveStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = ((data[i] ?? 128) - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      liveLevelRef.current = Math.min(1, rms * 3.2);

      const idx = Math.min(
        BAR_COUNT - 1,
        Math.floor(Math.min(1, Math.max(0, progressRef.current)) * BAR_COUNT),
      );
      const prev = recordedTrailRef.current[idx] ?? 0;
      recordedTrailRef.current[idx] = Math.max(prev * 0.82, liveLevelRef.current);

      redraw();
      raf = requestAnimationFrame(tick);
    };

    void audioCtx.resume().then(() => {
      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      void audioCtx.close();
      liveLevelRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveStream, recording]);

  return (
    <div className={cn("rounded-xl bg-surface-2 px-2 py-1", className)}>
      <canvas
        ref={canvasRef}
        className={cn("w-full", compact ? "h-5" : "h-7 sm:h-8")}
      />
    </div>
  );
}
