/**
 * Convert a Choicer Voicer Dub Pack ZIP into Dubmates catalog assets.
 *
 * Usage:
 *   node scripts/ingest-choicer-pack.mjs <zipPath> <slug> [--title "Title"] [--category "Mème"]
 */
import { spawnSync } from "node:child_process";
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const COLORS = ["#D9645B", "#3BA7F5", "#3FB950", "#C24FE0", "#FFC23D", "#E67E22", "#1ABC9C", "#9B59B6"];

function slugify(input) {
  return (
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "pack"
  );
}

function decodeText(bytes) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1251", { fatal: false }).decode(bytes);
  } catch {
    return utf8;
  }
}

function parseIni(text) {
  const data = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("[")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      data[key] = value.slice(1, -1);
      continue;
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      if (!inner) {
        data[key] = [];
        continue;
      }
      const parts = inner.split(",").map((p) => p.trim());
      if (parts.every((p) => /^-?\d+(\.\d+)?$/.test(p))) {
        data[key] = parts.map(Number);
      } else {
        data[key] = parts.map((p) => {
          if (
            (p.startsWith('"') && p.endsWith('"')) ||
            (p.startsWith("'") && p.endsWith("'"))
          ) {
            return p.slice(1, -1);
          }
          return p;
        });
      }
      continue;
    }
    data[key] = value;
  }
  return data;
}

function clipSortKey(name) {
  const m = name.match(/^(\d+)/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function characterId(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "character"
  );
}

function stripCaption(caption, characterName) {
  const trimmed = caption.trim().replace(/^["“]|["”]$/g, "");
  const escaped = characterName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\[${escaped}\\]\\s*`, "i");
  return trimmed.replace(re, "").replace(/^["“]|["”]$/g, "").trim() || trimmed;
}

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr?.slice(-2000) || `ffmpeg failed: ${args.join(" ")}`);
  }
}

function hasAudioStream(path) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path],
    { encoding: "utf8" },
  );
  return Boolean(result.stdout?.trim());
}

/** Transcode any audio container to MP3 for Safari-friendly catalog packs. */
function toMp3(inputPath, outputPath) {
  runFfmpeg(["-y", "-i", inputPath, "-codec:a", "libmp3lame", "-q:a", "4", outputPath]);
  if (inputPath !== outputPath) {
    try {
      unlinkSync(inputPath);
    } catch {
      // ignore
    }
  }
}

function probeDuration(filePath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", filePath],
    { encoding: "utf8" },
  );
  const value = Number(result.stdout.trim());
  return Number.isFinite(value) ? value : 1.5;
}

async function writeEntry(zip, entryPath, outPath) {
  const entry = zip.files[entryPath];
  if (!entry) throw new Error(`Missing ${entryPath}`);
  mkdirSync(dirname(outPath), { recursive: true });
  await pipeline(entry.nodeStream(), createWriteStream(outPath));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      'Usage: node scripts/ingest-choicer-pack.mjs <zip> <slug> [--title "..."] [--category "..."]',
    );
    process.exit(1);
  }

  const zipPath = args[0];
  const slug = slugify(args[1]);
  let titleOverride = null;
  let category = "Communautaire";
  for (let i = 2; i < args.length; i += 1) {
    if (args[i] === "--title") titleOverride = args[++i];
    if (args[i] === "--category") category = args[++i];
  }

  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const videoPath = paths.find((p) => basename(p).toLowerCase() === "dub_video.ogv");
  if (!videoPath) throw new Error(`No dub_video.ogv in ${zipPath}`);

  const packRoot = dirname(videoPath).replace(/\\/g, "/");
  const inRoot = (p) => (packRoot ? p === packRoot || p.startsWith(`${packRoot}/`) : true);
  const rootFiles = paths.filter(inRoot);

  const pubDir = join(root, "public", "packs", slug);
  const contentDir = join(root, "content", "packs", slug);
  mkdirSync(pubDir, { recursive: true });
  mkdirSync(contentDir, { recursive: true });

  const tmpVideo = join(pubDir, "_source.ogv");
  await writeEntry(zip, videoPath, tmpVideo);
  const outVideo = join(pubDir, "video.mp4");
  console.log(`[${slug}] converting video...`);
  runFfmpeg([
    "-y",
    "-i",
    tmpVideo,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outVideo,
  ]);
  // Some Dub Pack videos are silent; the site mixes backing + prompts for those.
  const videoHasAudio = hasAudioStream(tmpVideo);
  console.log(`[${slug}] video audio track: ${videoHasAudio ? "yes" : "no"}`);
  try {
    unlinkSync(tmpVideo);
  } catch {
    // ignore
  }

  const backingPath = rootFiles.find((p) =>
    basename(p).toLowerCase().startsWith("_backing_track."),
  );
  let backingFile;
  if (backingPath) {
    const srcExt = extname(backingPath).toLowerCase() || ".mp3";
    const srcName = `_backing_src${srcExt}`;
    await writeEntry(zip, backingPath, join(pubDir, srcName));
    backingFile = "backing.mp3";
    if (srcExt === ".mp3") {
      renameSync(join(pubDir, srcName), join(pubDir, backingFile));
    } else {
      toMp3(join(pubDir, srcName), join(pubDir, backingFile));
    }
  }

  const iconPath =
    rootFiles.find((p) => basename(p).toLowerCase() === "icon.png") ||
    rootFiles.find(
      (p) =>
        /\.(png|jpg|jpeg|webp)$/i.test(basename(p)) &&
        basename(p).toLowerCase().includes("icon"),
    );
  let thumbnail = "";
  if (iconPath) {
    thumbnail = `thumbnail${extname(iconPath).toLowerCase() || ".png"}`;
    await writeEntry(zip, iconPath, join(pubDir, thumbnail));
  }

  let title = titleOverride || basename(packRoot || slug);
  let authors = [];
  const packInfoPath = rootFiles.find((p) => basename(p).toLowerCase() === "_pack_info.ini");
  if (packInfoPath) {
    const info = parseIni(decodeText(await zip.files[packInfoPath].async("uint8array")));
    if (!titleOverride && typeof info.title === "string" && info.title) title = info.title;
    if (Array.isArray(info.authors)) authors = info.authors.filter((a) => typeof a === "string");
  }

  const audioFiles = rootFiles
    .filter((p) => {
      const name = basename(p);
      if (name.startsWith("_")) return false;
      return /\.(mp3|ogg|oga|wav|flac)$/i.test(name);
    })
    .sort(
      (a, b) =>
        clipSortKey(basename(a)) - clipSortKey(basename(b)) ||
        basename(a).localeCompare(basename(b)),
    );

  const drafts = [];
  for (const audioPath of audioFiles) {
    const base = basename(audioPath).replace(/\.(mp3|ogg|oga|wav|flac)$/i, "");
    const metaPath =
      rootFiles.find((p) => basename(p) === `${base}.txt`) ||
      rootFiles.find((p) => basename(p) === `${base}.ini`);

    let caption = base.replace(/^\d+[_\-\s]*/, "");
    let timestamps = [];
    let characterNames = [];
    if (metaPath) {
      const meta = parseIni(decodeText(await zip.files[metaPath].async("uint8array")));
      if (typeof meta.caption === "string") caption = meta.caption;
      if (Array.isArray(meta.dub_timestamps)) timestamps = meta.dub_timestamps;
      if (Array.isArray(meta.dub_characters)) characterNames = meta.dub_characters;
    }
    if (!characterNames.length) {
      const m = caption.match(/^\[([^\]]+)\]/);
      if (m) characterNames = [m[1]];
    }
    if (!characterNames.length) {
      characterNames = [base.replace(/^\d+[_\-\s]*/, "").trim() || "Character"];
    }

    drafts.push({
      audioPath,
      ext: extname(audioPath).toLowerCase() || ".mp3",
      caption,
      start: typeof timestamps[0] === "number" ? timestamps[0] : drafts.length,
      characterName: characterNames[0],
    });
  }

  drafts.sort((a, b) => a.start - b.start || a.audioPath.localeCompare(b.audioPath));

  const characters = new Map();
  const lines = [];
  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    const charId = characterId(draft.characterName);
    if (!characters.has(charId)) {
      characters.set(charId, {
        id: charId,
        name: draft.characterName,
        color: COLORS[characters.size % COLORS.length],
      });
    }

    const srcExt = draft.ext.toLowerCase() || ".mp3";
    const srcName = `prompt_${String(i + 1).padStart(2, "0")}_src${srcExt}`;
    const promptName = `prompt_${String(i + 1).padStart(2, "0")}.mp3`;
    await writeEntry(zip, draft.audioPath, join(pubDir, srcName));
    if (srcExt === ".mp3") {
      renameSync(join(pubDir, srcName), join(pubDir, promptName));
    } else {
      toMp3(join(pubDir, srcName), join(pubDir, promptName));
    }
    const duration = probeDuration(join(pubDir, promptName));
    const nextStart = drafts[i + 1]?.start;
    const naturalEnd = draft.start + duration;
    const end =
      typeof nextStart === "number"
        ? Math.max(draft.start + 0.25, Math.min(naturalEnd, nextStart - 0.02))
        : Math.max(draft.start + 0.25, naturalEnd);

    lines.push({
      id: `line_${String(i + 1).padStart(3, "0")}`,
      characterId: charId,
      text: stripCaption(draft.caption, draft.characterName),
      start: draft.start,
      end: Number(end.toFixed(3)),
      prompt: promptName,
    });
  }

  const last = lines[lines.length - 1];
  const videoDuration = probeDuration(outVideo);
  const duration = Math.max(videoDuration, (last?.end ?? 1) + 0.5);

  const pack = {
    id: slug,
    slug,
    language: "fr",
    title,
    description: authors.length
      ? `Pack communautaire · ${authors.join(", ")}`
      : "Pack communautaire adapté depuis un Dub Pack Choicer Voicer.",
    category,
    thumbnail,
    scenes: [
      {
        id: "main",
        title,
        duration: Number(duration.toFixed(2)),
        ...(thumbnail ? { thumbnail } : {}),
        video: "video.mp4",
        videoHasAudio,
        ...(backingFile ? { backing: backingFile } : {}),
        characters: [...characters.values()],
        lines,
      },
    ],
  };

  writeFileSync(join(contentDir, "pack.json"), `${JSON.stringify(pack, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        slug,
        title,
        clips: lines.length,
        duration: pack.scenes[0].duration,
        characters: pack.scenes[0].characters.map((c) => c.name),
        hasVideo: existsSync(outVideo),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
