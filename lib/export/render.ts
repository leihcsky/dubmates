import type { DialogueLine } from "@/lib/pack-types";
import { track } from "@/lib/analytics";

export interface ExportOptions {
  videoUrl: string;
  videoMime?: string;
  duration: number;
  lines: DialogueLine[];
  takes: Record<string, Blob>;
  backingUrl?: string;
  fileBase: string;
  onProgress?: (value: number) => void;
}

const BRAND_NAME = "Dubmates";
const BRAND_DOMAIN = "dubmates.org";
const END_CARD_MS = 2500;

function drawCornerWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const pad = Math.max(12, Math.round(width * 0.018));
  const titleSize = Math.max(14, Math.round(width * 0.022));
  const domainSize = Math.max(11, Math.round(width * 0.016));
  const lineGap = Math.round(titleSize * 0.35);

  ctx.save();
  ctx.font = `700 ${titleSize}px system-ui, sans-serif`;
  const titleW = ctx.measureText(BRAND_NAME).width;
  ctx.font = `600 ${domainSize}px system-ui, sans-serif`;
  const domainW = ctx.measureText(BRAND_DOMAIN).width;
  const textW = Math.max(titleW, domainW);
  const blockH = titleSize + lineGap + domainSize;
  const boxPadX = pad * 0.7;
  const boxPadY = pad * 0.45;
  const boxW = textW + boxPadX * 2;
  const boxH = blockH + boxPadY * 2;
  const boxX = width - pad - boxW;
  const boxY = height - pad - boxH;

  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
  } else {
    ctx.fillRect(boxX, boxY, boxW, boxH);
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = `700 ${titleSize}px system-ui, sans-serif`;
  ctx.fillText(BRAND_NAME, width - pad - boxPadX, boxY + boxPadY + titleSize);
  ctx.fillStyle = "rgba(255, 194, 61, 0.95)";
  ctx.font = `600 ${domainSize}px system-ui, sans-serif`;
  ctx.fillText(BRAND_DOMAIN, width - pad - boxPadX, boxY + boxPadY + titleSize + lineGap + domainSize);
  ctx.restore();
}

function drawEndCard(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#2a2e33");
  gradient.addColorStop(1, "#1a1d21");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const titleSize = Math.max(28, Math.round(width * 0.055));
  const domainSize = Math.max(18, Math.round(width * 0.032));

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${titleSize}px system-ui, sans-serif`;
  ctx.fillText(BRAND_NAME, width / 2, height / 2 - domainSize * 0.35);

  ctx.fillStyle = "#ffc23d";
  ctx.font = `700 ${domainSize}px system-ui, sans-serif`;
  ctx.fillText(BRAND_DOMAIN, width / 2, height / 2 + titleSize * 0.55);
  ctx.restore();
}

function waitFrames(
  durationMs: number,
  onFrame: (elapsed: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      const elapsed = performance.now() - started;
      onFrame(elapsed);
      if (elapsed >= durationMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function pickVideoMimeType() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
}

async function decodeBlob(ctx: AudioContext, blob: Blob) {
  const copy = await blob.arrayBuffer();
  return ctx.decodeAudioData(copy);
}

function needsOgv(mime?: string, url?: string) {
  if (mime?.includes("ogg") || mime?.includes("ogv")) return true;
  return Boolean(url?.toLowerCase().includes(".ogv"));
}

async function createSourceVideo(url: string, mime?: string) {
  if (!needsOgv(mime, url)) {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Video could not be loaded"));
    });
    return {
      video: video as HTMLVideoElement,
      cleanup: () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      },
    };
  }

  const ogv = await import("ogv");
  ogv.OGVLoader.base = "/ogv";
  const player = new ogv.OGVPlayer({ wasm: true }) as unknown as HTMLVideoElement;
  player.muted = true;
  player.setAttribute("playsinline", "true");
  player.style.position = "fixed";
  player.style.left = "-9999px";
  player.style.width = "1280px";
  player.style.height = "720px";
  document.body.appendChild(player);
  player.src = url;

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanupListeners();
      resolve();
    };
    const onError = () => {
      cleanupListeners();
      reject(new Error("OGV video could not be loaded"));
    };
    const cleanupListeners = () => {
      player.removeEventListener("loadeddata", onReady);
      player.removeEventListener("loadedmetadata", onReady);
      player.removeEventListener("error", onError);
    };
    player.addEventListener("loadeddata", onReady);
    player.addEventListener("loadedmetadata", onReady);
    player.addEventListener("error", onError);
    window.setTimeout(() => {
      if ((player.videoWidth || 0) > 0 || (player.duration || 0) > 0) onReady();
    }, 2500);
  });

  return {
    video: player,
    cleanup: () => {
      try {
        player.pause();
      } catch {
        // ignore
      }
      player.remove();
    },
  };
}

export async function exportDub(options: ExportOptions) {
  track("export_start", { fileBase: options.fileBase, mime: options.videoMime });

  const { video, cleanup } = await createSourceVideo(options.videoUrl, options.videoMime);

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  document.body.appendChild(canvas);
  const draw = canvas.getContext("2d");
  if (!draw) throw new Error("Canvas is not available");
  try {
    draw.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch {
    // OGV canvas draw may need a frame; continue and catch up in the loop.
  }

  const audioCtx = new AudioContext();
  await audioCtx.resume();
  const dest = audioCtx.createMediaStreamDestination();
  let backingSource: AudioBufferSourceNode | null = null;

  if (options.backingUrl) {
    try {
      const response = await fetch(options.backingUrl);
      const buffer = await decodeBlob(audioCtx, await response.blob());
      backingSource = audioCtx.createBufferSource();
      backingSource.buffer = buffer;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.35;
      backingSource.connect(gain).connect(dest);
    } catch {
      // optional
    }
  }

  const takeSources: { source: AudioBufferSourceNode; start: number; window: number }[] = [];
  for (const line of options.lines) {
    const blob = options.takes[line.id];
    if (!blob) continue;
    try {
      const buffer = await decodeBlob(audioCtx, blob);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(dest);
      takeSources.push({
        source,
        start: line.start,
        window: Math.max(0.2, line.end - line.start + 0.35),
      });
    } catch {
      // skip
    }
  }

  const canvasStream = canvas.captureStream(30);
  const mixed = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = pickVideoMimeType();
  const recorder = new MediaRecorder(mixed, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error("MediaRecorder failed"));
  });

  recorder.start(200);
  const t0 = audioCtx.currentTime + 0.05;
  backingSource?.start(t0);
  for (const item of takeSources) {
    item.source.start(t0 + item.start, 0, item.window);
  }

  video.currentTime = 0;
  await video.play();

  const durationMs = options.duration * 1000;
  const totalMs = durationMs + END_CARD_MS;

  await new Promise<void>((resolve) => {
    const started = performance.now();
    const tick = () => {
      try {
        draw.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch {
        // frame not ready
      }
      drawCornerWatermark(draw, canvas.width, canvas.height);
      const elapsed = performance.now() - started;
      options.onProgress?.(Math.min(0.92, elapsed / totalMs));
      if (elapsed >= durationMs || video.ended) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

  video.pause();

  await waitFrames(END_CARD_MS, (elapsed) => {
    drawEndCard(draw, canvas.width, canvas.height);
    options.onProgress?.(Math.min(1, (durationMs + elapsed) / totalMs));
  });

  if (recorder.state === "recording") recorder.stop();
  const blob = await finished;
  await audioCtx.close();
  canvas.remove();
  cleanup();

  track("export_success", { fileBase: options.fileBase });
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
