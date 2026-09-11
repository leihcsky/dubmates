/**
 * Minimal FFmpeg.wasm client that starts the worker from a plain absolute URL.
 * Avoids `@ffmpeg/ffmpeg`'s `new Worker(new URL(variable, import.meta.url))`,
 * which Turbopack cannot statically resolve (`Can't resolve <dynamic>`).
 */

const FFMessageType = {
  LOAD: "LOAD",
  EXEC: "EXEC",
  WRITE_FILE: "WRITE_FILE",
  READ_FILE: "READ_FILE",
  DELETE_FILE: "DELETE_FILE",
  ERROR: "ERROR",
  PROGRESS: "PROGRESS",
  LOG: "LOG",
} as const;

type ProgressCallback = (event: { progress: number; time: number }) => void;
type LogCallback = (event: { type: string; message: string }) => void;

let messageID = 0;
const nextId = () => messageID++;

export class FFmpegClient {
  #worker: Worker | null = null;
  #resolves: Record<number, (value: unknown) => void> = {};
  #rejects: Record<number, (reason?: unknown) => void> = {};
  #progressCallbacks: ProgressCallback[] = [];
  #logCallbacks: LogCallback[] = [];
  loaded = false;

  #registerHandlers() {
    if (!this.#worker) return;
    this.#worker.onmessage = ({
      data: { id, type, data },
    }: MessageEvent<{ id: number; type: string; data: unknown }>) => {
      switch (type) {
        case FFMessageType.LOAD:
          this.loaded = true;
          this.#resolves[id]?.(data);
          break;
        case FFMessageType.EXEC:
        case FFMessageType.WRITE_FILE:
        case FFMessageType.READ_FILE:
        case FFMessageType.DELETE_FILE:
          this.#resolves[id]?.(data);
          break;
        case FFMessageType.LOG:
          this.#logCallbacks.forEach((fn) => fn(data as { type: string; message: string }));
          break;
        case FFMessageType.PROGRESS:
          this.#progressCallbacks.forEach((fn) =>
            fn(data as { progress: number; time: number }),
          );
          break;
        case FFMessageType.ERROR:
          this.#rejects[id]?.(data);
          break;
        default:
          break;
      }
      delete this.#resolves[id];
      delete this.#rejects[id];
    };
  }

  #send(
    message: { type: string; data?: unknown },
    transfer: Transferable[] = [],
  ): Promise<unknown> {
    if (!this.#worker) {
      return Promise.reject(new Error("ffmpeg is not loaded"));
    }
    return new Promise((resolve, reject) => {
      const id = nextId();
      this.#worker?.postMessage({ id, type: message.type, data: message.data }, transfer);
      this.#resolves[id] = resolve;
      this.#rejects[id] = reject;
    });
  }

  on(event: "progress", callback: ProgressCallback): void;
  on(event: "log", callback: LogCallback): void;
  on(event: "progress" | "log", callback: ProgressCallback | LogCallback) {
    if (event === "progress") this.#progressCallbacks.push(callback as ProgressCallback);
    else this.#logCallbacks.push(callback as LogCallback);
  }

  off(event: "progress", callback: ProgressCallback): void;
  off(event: "log", callback: LogCallback): void;
  off(event: "progress" | "log", callback: ProgressCallback | LogCallback) {
    if (event === "progress") {
      this.#progressCallbacks = this.#progressCallbacks.filter((fn) => fn !== callback);
    } else {
      this.#logCallbacks = this.#logCallbacks.filter((fn) => fn !== callback);
    }
  }

  async load(config: {
    coreURL: string;
    wasmURL: string;
    classWorkerURL: string;
  }) {
    if (!this.#worker) {
      // Absolute/blob URL string — do not wrap in `new URL(..., import.meta.url)`.
      this.#worker = new Worker(config.classWorkerURL, { type: "module" });
      this.#registerHandlers();
    }
    return this.#send({
      type: FFMessageType.LOAD,
      data: { coreURL: config.coreURL, wasmURL: config.wasmURL },
    });
  }

  exec(args: string[], timeout = -1) {
    return this.#send({
      type: FFMessageType.EXEC,
      data: { args, timeout },
    }) as Promise<number>;
  }

  writeFile(path: string, data: Uint8Array | string) {
    const transfer: Transferable[] = [];
    if (data instanceof Uint8Array) transfer.push(data.buffer);
    return this.#send(
      { type: FFMessageType.WRITE_FILE, data: { path, data } },
      transfer,
    );
  }

  readFile(path: string, encoding: "binary" | "utf8" = "binary") {
    return this.#send({
      type: FFMessageType.READ_FILE,
      data: { path, encoding },
    }) as Promise<Uint8Array | string>;
  }

  deleteFile(path: string) {
    return this.#send({
      type: FFMessageType.DELETE_FILE,
      data: { path },
    });
  }
}
