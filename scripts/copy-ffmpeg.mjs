import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const coreSource = join(root, "node_modules", "@ffmpeg", "core", "dist", "esm");
const ffmpegSource = join(root, "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
const target = join(root, "public", "ffmpeg");

mkdirSync(join(root, "public"), { recursive: true });
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

cpSync(join(coreSource, "ffmpeg-core.js"), join(target, "ffmpeg-core.js"));
cpSync(join(coreSource, "ffmpeg-core.wasm"), join(target, "ffmpeg-core.wasm"));

// Worker must be served as a static asset (not bundled) so Turbopack
// never analyzes its dynamic `import(coreURL)`.
for (const name of ["worker.js", "const.js", "errors.js"]) {
  cpSync(join(ffmpegSource, name), join(target, name));
}

console.log(`Copied ffmpeg.wasm assets to ${target}`);
