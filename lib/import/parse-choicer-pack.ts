import JSZip from "jszip";
import type { Character, DialogueLine, DubPack, PackScene } from "@/lib/pack-types";
import {
  asNumberArray,
  asString,
  asStringArray,
  decodeIniText,
  parseIniData,
} from "@/lib/import/ini";

const CHARACTER_COLORS = [
  "#D9645B",
  "#3BA7F5",
  "#3FB950",
  "#C24FE0",
  "#FFC23D",
  "#E67E22",
  "#1ABC9C",
  "#9B59B6",
];

export class PackImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackImportError";
  }
}

export interface ParsedChoicerPack {
  pack: DubPack;
  videoBlob: Blob;
  videoMime: string;
  backingBlob?: Blob;
  thumbnailBlob?: Blob;
  promptBlobs: Record<string, Blob>;
  sourceFolder: string;
}

function basename(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function dirname(path: string) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function joinPath(...parts: string[]) {
  return parts.filter(Boolean).join("/");
}

function slugify(input: string) {
  const ascii = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return ascii || "imported-pack";
}

function shortHash(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function clipSortKey(fileName: string) {
  const match = fileName.match(/^(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function characterIdFromName(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "character"
  );
}

function stripCaptionCharacterPrefix(caption: string, characterName: string) {
  const trimmed = caption.trim();
  const prefixed = new RegExp(`^\\[${escapeRegExp(characterName)}\\]\\s*`, "i");
  return trimmed.replace(prefixed, "").replace(/^["“]|["”]$/g, "").trim() || trimmed;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function blobDurationSeconds(blob: Blob): Promise<number> {
  try {
    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const duration = buffer.duration;
    await ctx.close();
    return duration;
  } catch {
    return await new Promise<number>((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const value = Number.isFinite(audio.duration) ? audio.duration : 1.5;
        URL.revokeObjectURL(url);
        resolve(value);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(1.5);
      };
      audio.src = url;
    });
  }
}

function mimeForVideoName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ogv") || lower.endsWith(".ogg")) return "video/ogg";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function mimeForAudioName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".flac")) return "audio/flac";
  return "application/octet-stream";
}

function findPackRoot(paths: string[]) {
  const videoPath = paths.find((path) => basename(path).toLowerCase() === "dub_video.ogv");
  if (videoPath) return dirname(videoPath);

  const alt = paths.find((path) => {
    const name = basename(path).toLowerCase();
    return name.startsWith("dub_video.") && /\.(ogv|ogg|mp4|webm)$/.test(name);
  });
  if (alt) return dirname(alt);

  return null;
}

export async function parseChoicerPackZip(file: File | Blob): Promise<ParsedChoicerPack> {
  const zip = await JSZip.loadAsync(file);
  const paths = Object.keys(zip.files).filter((path) => !zip.files[path]?.dir);
  if (paths.length === 0) {
    throw new PackImportError("Le ZIP est vide.");
  }

  const root = findPackRoot(paths);
  if (root === null && !paths.some((path) => basename(path).toLowerCase().startsWith("dub_video."))) {
    throw new PackImportError(
      "Ce ZIP n’est pas un Dub Pack Choicer Voicer (fichier dub_video.ogv introuvable).",
    );
  }

  const packRoot = root ?? "";
  const inRoot = (path: string) => {
    if (!packRoot) return !path.includes("/") || dirname(path) === "";
    return path === packRoot || path.startsWith(`${packRoot}/`);
  };

  const rootFiles = paths.filter(inRoot);
  const videoEntryPath =
    rootFiles.find((path) => basename(path).toLowerCase() === "dub_video.ogv") ??
    rootFiles.find((path) => basename(path).toLowerCase().startsWith("dub_video."));
  if (!videoEntryPath) {
    throw new PackImportError("dub_video.ogv est manquant dans ce pack.");
  }

  const videoBlob = await zip.files[videoEntryPath]!.async("blob");
  const videoMime = mimeForVideoName(videoEntryPath);
  const typedVideoBlob =
    videoBlob.type && videoBlob.type !== "application/octet-stream"
      ? videoBlob
      : new Blob([videoBlob], { type: videoMime });

  const backingPath = rootFiles.find((path) =>
    basename(path).toLowerCase().startsWith("_backing_track."),
  );
  const backingRaw = backingPath ? await zip.files[backingPath]!.async("blob") : undefined;
  const backingBlob = backingRaw
    ? new Blob([backingRaw], { type: mimeForAudioName(backingPath!) })
    : undefined;

  let title = basename(packRoot || "Imported pack") || "Imported pack";
  let authors: string[] = [];
  const packInfoPath = rootFiles.find((path) => basename(path).toLowerCase() === "_pack_info.ini");
  if (packInfoPath) {
    const info = parseIniData(decodeIniText(await zip.files[packInfoPath]!.async("uint8array")));
    title = asString(info.title, title) || title;
    authors = asStringArray(info.authors);
  }

  const iconPath =
    rootFiles.find((path) => basename(path).toLowerCase() === "icon.png") ??
    rootFiles.find(
      (path) =>
        /\.(png|jpg|jpeg|webp)$/i.test(basename(path)) &&
        basename(path).toLowerCase().startsWith("icon"),
    );
  const thumbnailBlob = iconPath ? await zip.files[iconPath]!.async("blob") : undefined;

  const audioFiles = rootFiles
    .filter((path) => {
      const name = basename(path);
      if (name.startsWith("_")) return false;
      return /\.(mp3|ogg|oga|wav|flac)$/i.test(name);
    })
    .sort((a, b) => clipSortKey(basename(a)) - clipSortKey(basename(b)) || a.localeCompare(b));

  if (audioFiles.length === 0) {
    throw new PackImportError("Aucune réplique audio trouvée dans ce Dub Pack.");
  }

  const characters = new Map<string, Character>();
  const lines: DialogueLine[] = [];
  const promptBlobs: Record<string, Blob> = {};
  const starts: number[] = [];
  const durations: number[] = [];

  for (const audioPath of audioFiles) {
    const base = basename(audioPath).replace(/\.(mp3|ogg|oga|wav|flac)$/i, "");
    const metaPath =
      rootFiles.find((path) => basename(path) === `${base}.txt`) ??
      rootFiles.find((path) => basename(path) === `${base}.ini`);

    let caption = base.replace(/^\d+[_\-\s]*/, "");
    let timestamps: number[] = [];
    let characterNames: string[] = [];

    if (metaPath) {
      const meta = parseIniData(decodeIniText(await zip.files[metaPath]!.async("uint8array")));
      caption = asString(meta.caption, caption) || caption;
      timestamps = asNumberArray(meta.dub_timestamps);
      characterNames = asStringArray(meta.dub_characters);
    }

    if (characterNames.length === 0) {
      const match = caption.match(/^\[([^\]]+)\]/);
      if (match) characterNames = [match[1]!];
    }
    if (characterNames.length === 0) {
      const fromFile = base.replace(/^\d+[_\-\s]*/, "").trim();
      characterNames = [fromFile || "Character"];
    }

    const characterName = characterNames[0]!;
    const charId = characterIdFromName(characterName);
    if (!characters.has(charId)) {
      characters.set(charId, {
        id: charId,
        name: characterName,
        color: CHARACTER_COLORS[characters.size % CHARACTER_COLORS.length]!,
      });
    }

    const audioBlobRaw = await zip.files[audioPath]!.async("blob");
    const audioBlob = new Blob([audioBlobRaw], { type: mimeForAudioName(audioPath) });
    const duration = await blobDurationSeconds(audioBlob);
    const start = timestamps[0] ?? starts.length;
    const lineId = `line_${String(lines.length + 1).padStart(3, "0")}`;

    promptBlobs[lineId] = audioBlob;
    starts.push(start);
    durations.push(duration);
    lines.push({
      id: lineId,
      characterId: charId,
      text: stripCaptionCharacterPrefix(caption, characterName),
      start,
      end: start + duration,
      prompt: lineId,
    });
  }

  // Sort by timeline, then recompute end as min(start+duration, next.start).
  const order = lines
    .map((_, index) => index)
    .sort((a, b) => starts[a]! - starts[b]! || a - b);
  const orderedLines = order.map((index) => lines[index]!);
  const orderedStarts = order.map((index) => starts[index]!);
  const orderedDurations = order.map((index) => durations[index]!);

  for (let i = 0; i < orderedLines.length; i += 1) {
    const start = orderedStarts[i]!;
    const nextStart = orderedStarts[i + 1];
    const naturalEnd = start + orderedDurations[i]!;
    const end =
      typeof nextStart === "number"
        ? Math.max(start + 0.25, Math.min(naturalEnd, nextStart - 0.02))
        : Math.max(start + 0.25, naturalEnd);
    orderedLines[i] = { ...orderedLines[i]!, start, end };
  }

  const last = orderedLines[orderedLines.length - 1]!;
  const duration = Math.max(last.end + 0.5, last.start + 1);
  const folderLabel = packRoot || title;
  const idSeed = `${folderLabel}|${audioFiles.length}|${typedVideoBlob.size}|${title}`;
  const slug = `import-${slugify(title)}-${shortHash(idSeed)}`;
  const scene: PackScene = {
    id: "main",
    title,
    duration,
    thumbnail: thumbnailBlob ? "icon.png" : undefined,
    video: basename(videoEntryPath),
    backing: backingBlob ? basename(backingPath!) : undefined,
    characters: [...characters.values()],
    lines: orderedLines,
  };

  const pack: DubPack = {
    id: slug,
    slug,
    language: "fr",
    title,
    description: authors.length
      ? `Pack importé · ${authors.join(", ")}`
      : "Pack importé depuis un ZIP Choicer Voicer",
    category: "Importé",
    thumbnail: thumbnailBlob ? "icon.png" : "",
    scenes: [scene],
  };

  return {
    pack,
    videoBlob: typedVideoBlob,
    videoMime,
    backingBlob,
    thumbnailBlob,
    promptBlobs,
    sourceFolder: folderLabel,
  };
}

export function resolveImportedPack(
  parsed: ParsedChoicerPack,
  urls: {
    videoUrl: string;
    backingUrl?: string;
    thumbnailUrl?: string;
    promptUrls: Record<string, string>;
  },
) {
  const scene = parsed.pack.scenes[0]!;
  return {
    ...parsed.pack,
    thumbnailUrl: urls.thumbnailUrl ?? "",
    scenes: [
      {
        ...scene,
        videoUrl: urls.videoUrl,
        thumbnailUrl: urls.thumbnailUrl ?? "",
        backingUrl: urls.backingUrl,
        videoMime: parsed.videoMime,
        promptUrls: urls.promptUrls,
      },
    ],
  };
}
