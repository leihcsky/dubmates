/** Minimal parser for Choicer Voicer clip / pack INI-like metadata. */

export type IniData = Record<string, string | number[] | string[]>;

function decodeBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // Prefer UTF-8 when it looks sane; otherwise try Windows-1251 (common for RU packs).
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacementCount === 0) return utf8;
  try {
    return new TextDecoder("windows-1251", { fatal: false }).decode(bytes);
  } catch {
    return utf8;
  }
}

export function decodeIniText(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return decodeBytes(view);
}

export function parseIniData(text: string): IniData {
  const data: IniData = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("[") || line.startsWith(";") || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
      data[key] = value;
      continue;
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      if (!inner) {
        data[key] = [];
        continue;
      }
      const parts = inner.split(",").map((part) => part.trim());
      if (parts.every((part) => /^-?\d+(\.\d+)?$/.test(part))) {
        data[key] = parts.map(Number);
      } else {
        data[key] = parts.map((part) => {
          if (
            (part.startsWith('"') && part.endsWith('"')) ||
            (part.startsWith("'") && part.endsWith("'"))
          ) {
            return part.slice(1, -1);
          }
          return part;
        });
      }
      continue;
    }
    data[key] = value;
  }
  return data;
}

export function asString(value: string | number[] | string[] | undefined, fallback = "") {
  if (typeof value === "string") return value;
  return fallback;
}

export function asNumberArray(value: string | number[] | string[] | undefined): number[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return value as number[];
  }
  return [];
}

export function asStringArray(value: string | number[] | string[] | undefined): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value as string[];
  }
  if (typeof value === "string" && value) return [value];
  return [];
}
