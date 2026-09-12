/**
 * Mixer for previewing a scene's original soundtrack.
 *
 * Dub Pack videos (`dub_video.ogv`, and the MP4 we transcode from it) carry
 * **no audio track** — the sound lives in `_backing_track` plus one prompt clip
 * per line. So "watch the video" has to play those alongside the picture.
 */

import type { DialogueLine } from "@/lib/pack-types";

export interface SceneAudioTrack {
  url: string;
  /** Seconds into the scene where this clip starts. */
  start: number;
  /** Seconds into the scene where the line ends (prompts only). */
  end?: number;
  gain?: number;
}

interface LoadedTrack extends SceneAudioTrack {
  buffer: AudioBuffer;
}

/**
 * XHR rather than `fetch`: some browser extensions wrap `window.fetch` and make
 * it reject on `blob:` URLs, which is how imported packs expose their clips.
 */
export function loadArrayBuffer(url: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.onload = () => {
      const ok = request.status === 0 || (request.status >= 200 && request.status < 300);
      if (ok && request.response) resolve(request.response as ArrayBuffer);
      else reject(new Error(`Failed to load ${url} (${request.status})`));
    };
    request.onerror = () => reject(new Error(`Failed to load ${url}`));
    request.send();
  });
}

export interface SceneAudioHandle {
  /** Start (or restart) playback from `offset` seconds into the scene. */
  start: (offset: number) => Promise<void>;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  close: () => void;
}

const TAIL_SECONDS = 0.35;
const BACKING_GAIN = 0.5;

/** Original soundtrack for a scene: backing bed plus one clip per spoken line. */
export function buildSceneAudioTracks(scene: {
  backingUrl?: string;
  lines: DialogueLine[];
  promptUrls?: Record<string, string>;
}): SceneAudioTrack[] {
  const tracks: SceneAudioTrack[] = [];
  if (scene.backingUrl) {
    tracks.push({ url: scene.backingUrl, start: 0, gain: BACKING_GAIN });
  }
  for (const line of scene.lines) {
    const url =
      scene.promptUrls?.[line.id] ?? (line.prompt ? scene.promptUrls?.[line.prompt] : undefined);
    if (url) tracks.push({ url, start: line.start, end: line.end });
  }
  return tracks;
}

export function createSceneAudio(tracks: SceneAudioTrack[]): SceneAudioHandle {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let loaded: LoadedTrack[] | null = null;
  let loading: Promise<LoadedTrack[]> | null = null;
  let active: AudioBufferSourceNode[] = [];
  let muted = false;
  let closed = false;
  let generation = 0;

  function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    }
    return { ctx, master: master! };
  }

  async function ensureLoaded() {
    if (loaded) return loaded;
    if (!loading) {
      const { ctx: audioCtx } = ensureContext();
      loading = (async () => {
        const results = await Promise.all(
          tracks.map(async (track) => {
            try {
              const bytes = await loadArrayBuffer(track.url);
              const buffer = await audioCtx.decodeAudioData(bytes);
              return { ...track, buffer } satisfies LoadedTrack;
            } catch {
              return null;
            }
          }),
        );
        loaded = results.filter((item): item is LoadedTrack => item !== null);
        return loaded;
      })();
    }
    return loading;
  }

  function stopActive() {
    for (const source of active) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    active = [];
  }

  return {
    async start(offset: number) {
      if (closed || tracks.length === 0) return;
      const token = ++generation;
      stopActive();

      const { ctx: audioCtx, master: gain } = ensureContext();
      const items = await ensureLoaded();
      // A newer start() (or stop) happened while decoding.
      if (closed || token !== generation) return;

      await audioCtx.resume();
      if (closed || token !== generation) return;

      const base = audioCtx.currentTime + 0.06;
      for (const item of items) {
        const bufferOffset = Math.max(0, offset - item.start);
        if (bufferOffset >= item.buffer.duration) continue;

        const source = audioCtx.createBufferSource();
        source.buffer = item.buffer;
        if (item.gain !== undefined && item.gain !== 1) {
          const clipGain = audioCtx.createGain();
          clipGain.gain.value = item.gain;
          source.connect(clipGain).connect(gain);
        } else {
          source.connect(gain);
        }

        const when = base + Math.max(0, item.start - offset);
        if (item.end !== undefined) {
          const window = Math.max(0.2, item.end - item.start + TAIL_SECONDS - bufferOffset);
          source.start(when, bufferOffset, window);
        } else {
          source.start(when, bufferOffset);
        }
        active.push(source);
      }
    },
    stop() {
      generation += 1;
      stopActive();
    },
    setMuted(next: boolean) {
      muted = next;
      if (master) master.gain.value = next ? 0 : 1;
    },
    close() {
      closed = true;
      generation += 1;
      stopActive();
      const current = ctx;
      ctx = null;
      master = null;
      if (current) void current.close().catch(() => {});
    },
  };
}
