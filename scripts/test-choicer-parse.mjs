import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import JSZip from "jszip";

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error(
    "Usage: node scripts/test-choicer-parse.mjs <pack.zip> [more.zip...]",
  );
  process.exit(1);
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
    if (value.startsWith('"') && value.endsWith('"')) {
      data[key] = value.slice(1, -1);
      continue;
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      data[key] = inner
        ? inner.split(",").map((part) => {
            const p = part.trim();
            if (p.startsWith('"') && p.endsWith('"')) return p.slice(1, -1);
            if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
            return p;
          })
        : [];
      continue;
    }
    data[key] = value;
  }
  return data;
}

async function inspectZip(filePath) {
  const buf = readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const video = paths.find((p) => basename(p).toLowerCase() === "dub_video.ogv");
  if (!video) {
    throw new Error("dub_video.ogv missing");
  }
  const root = dirname(video).replace(/\\/g, "/");
  const inRoot = paths.filter((p) => (root ? p.startsWith(`${root}/`) : true));
  const infoPath = inRoot.find((p) => basename(p).toLowerCase() === "_pack_info.ini");
  const info = infoPath
    ? parseIni(decodeText(await zip.files[infoPath].async("uint8array")))
    : {};
  const audios = inRoot
    .filter((p) => /\.(mp3|ogg|wav)$/i.test(basename(p)) && !basename(p).startsWith("_"))
    .sort((a, b) => basename(a).localeCompare(basename(b), undefined, { numeric: true }));

  const lines = [];
  for (const audio of audios) {
    const base = basename(audio).replace(/\.(mp3|ogg|wav)$/i, "");
    const metaPath =
      inRoot.find((p) => basename(p) === `${base}.txt`) ||
      inRoot.find((p) => basename(p) === `${base}.ini`);
    if (!metaPath) {
      lines.push({ file: base, error: "missing meta" });
      continue;
    }
    const meta = parseIni(decodeText(await zip.files[metaPath].async("uint8array")));
    lines.push({
      file: base,
      caption: meta.caption,
      start: Array.isArray(meta.dub_timestamps) ? meta.dub_timestamps[0] : null,
      characters: meta.dub_characters,
    });
  }

  return {
    file: filePath,
    folder: root || "(zip root)",
    title: info.title || root || basename(filePath),
    authors: info.authors || [],
    video,
    clips: lines.length,
    sample: lines.slice(0, 3),
  };
}

for (const target of targets) {
  const result = await inspectZip(target);
  console.log(JSON.stringify(result, null, 2));
}
