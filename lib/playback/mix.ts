import type { DialogueLine } from "@/lib/pack-types";
import { loadArrayBuffer } from "@/lib/playback/scene-audio";

export interface MixHandle {
  stop: () => void;
}

async function decodeBlob(ctx: AudioContext, blob: Blob) {
  const copy = await blob.arrayBuffer();
  return ctx.decodeAudioData(copy);
}

export async function playDub(options: {
  video: HTMLVideoElement | HTMLMediaElement;
  lines: DialogueLine[];
  takes: Record<string, Blob>;
  backingUrl?: string;
}): Promise<MixHandle> {
  const ctx = new AudioContext();
  await ctx.resume();

  const sources: AudioBufferSourceNode[] = [];
  const startAt = ctx.currentTime + 0.08;

  if (options.backingUrl) {
    try {
      const buffer = await ctx.decodeAudioData(await loadArrayBuffer(options.backingUrl));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.35;
      source.connect(gain).connect(ctx.destination);
      source.start(startAt);
      sources.push(source);
    } catch {
      // Backing is optional.
    }
  }

  for (const line of options.lines) {
    const blob = options.takes[line.id];
    if (!blob) continue;
    try {
      const buffer = await decodeBlob(ctx, blob);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const window = Math.max(0.2, line.end - line.start + 0.35);
      source.start(startAt + line.start, 0, window);
      sources.push(source);
    } catch {
      // Skip a take the browser cannot decode.
    }
  }

  const video = options.video;
  video.muted = true;
  video.currentTime = 0;
  await video.play();

  return {
    stop() {
      video.pause();
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // already stopped
        }
      }
      void ctx.close();
    },
  };
}
