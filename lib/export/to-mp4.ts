import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { track } from "@/lib/analytics";
import { FFmpegClient } from "@/lib/export/ffmpeg-client";

let ffmpegSingleton: Promise<FFmpegClient> | null = null;

async function getFFmpeg(onLoadProgress?: (ratio: number) => void) {
  if (!ffmpegSingleton) {
    ffmpegSingleton = (async () => {
      const ffmpeg = new FFmpegClient();
      const base = `${window.location.origin}/ffmpeg`;
      const [coreURL, wasmURL, classWorkerURL] = await Promise.all([
        toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm", true, ({ received, total }) => {
          if (total > 0) onLoadProgress?.(received / total);
        }),
        // Worker itself must stay a real http(s) URL so relative imports
        // (./const.js, ./errors.js) resolve under /ffmpeg/.
        Promise.resolve(`${base}/worker.js`),
      ]);
      await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
      return ffmpeg;
    })().catch((error) => {
      ffmpegSingleton = null;
      throw error;
    });
  }
  return ffmpegSingleton;
}

function asBlobPart(data: Uint8Array | string): BlobPart {
  if (typeof data === "string") return data;
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/**
 * Convert a WebM blob to H.264/AAC MP4 in the browser via ffmpeg.wasm (single-thread core).
 * No SharedArrayBuffer / COOP-COEP headers required.
 */
export async function convertWebmToMp4(
  webm: Blob,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  track("export_mp4_start", { bytes: webm.size });
  onProgress?.(0.02);

  const ffmpeg = await getFFmpeg((ratio) => onProgress?.(0.02 + ratio * 0.18));
  onProgress?.(0.2);

  const onProg = ({ progress }: { progress: number }) => {
    onProgress?.(0.2 + Math.min(1, Math.max(0, progress)) * 0.78);
  };
  ffmpeg.on("progress", onProg);

  try {
    await ffmpeg.writeFile("input.webm", await fetchFile(webm));
    const code = await ffmpeg.exec([
      "-i",
      "input.webm",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "28",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
    if (code !== 0) {
      throw new Error(`FFmpeg exited with code ${code}`);
    }
    const data = await ffmpeg.readFile("output.mp4");
    onProgress?.(1);
    const blob = new Blob([asBlobPart(data)], { type: "video/mp4" });
    track("export_mp4_success", { bytes: blob.size });
    return blob;
  } catch (error) {
    track("export_mp4_failure");
    throw error;
  } finally {
    ffmpeg.off("progress", onProg);
    try {
      await ffmpeg.deleteFile("input.webm");
    } catch {
      // ignore
    }
    try {
      await ffmpeg.deleteFile("output.mp4");
    } catch {
      // ignore
    }
  }
}
