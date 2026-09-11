import type { DubPack } from "@/lib/pack-types";
import type { ParsedChoicerPack } from "@/lib/import/parse-choicer-pack";

const DB_NAME = "dubmates-imports";
const STORE = "packs";
const VERSION = 1;

export interface StoredImportedPack {
  id: string;
  importedAt: number;
  sourceName: string;
  sourceFolder: string;
  videoMime: string;
  pack: DubPack;
  videoBlob: Blob;
  backingBlob?: Blob;
  thumbnailBlob?: Blob;
  promptBlobs: Record<string, Blob>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reqToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveImportedPack(
  parsed: ParsedChoicerPack,
  sourceName: string,
): Promise<StoredImportedPack> {
  const record: StoredImportedPack = {
    id: parsed.pack.id,
    importedAt: Date.now(),
    sourceName,
    sourceFolder: parsed.sourceFolder,
    videoMime: parsed.videoMime,
    pack: parsed.pack,
    videoBlob: parsed.videoBlob,
    backingBlob: parsed.backingBlob,
    thumbnailBlob: parsed.thumbnailBlob,
    promptBlobs: parsed.promptBlobs,
  };
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await reqToPromise(tx.objectStore(STORE).put(record));
  db.close();
  return record;
}

export async function getImportedPack(id: string) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const record = await reqToPromise(tx.objectStore(STORE).get(id));
  db.close();
  return (record as StoredImportedPack | undefined) ?? null;
}

export async function listImportedPacks() {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const all = (await reqToPromise(tx.objectStore(STORE).getAll())) as StoredImportedPack[];
  db.close();
  return all.sort((a, b) => b.importedAt - a.importedAt);
}

export async function deleteImportedPack(id: string) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await reqToPromise(tx.objectStore(STORE).delete(id));
  db.close();
}

export function createImportedObjectUrls(record: StoredImportedPack) {
  const videoUrl = URL.createObjectURL(record.videoBlob);
  const backingUrl = record.backingBlob ? URL.createObjectURL(record.backingBlob) : undefined;
  const thumbnailUrl = record.thumbnailBlob
    ? URL.createObjectURL(record.thumbnailBlob)
    : undefined;
  const promptUrls: Record<string, string> = {};
  for (const [lineId, blob] of Object.entries(record.promptBlobs)) {
    promptUrls[lineId] = URL.createObjectURL(blob);
  }
  return {
    videoUrl,
    backingUrl,
    thumbnailUrl,
    promptUrls,
    revoke() {
      URL.revokeObjectURL(videoUrl);
      if (backingUrl) URL.revokeObjectURL(backingUrl);
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
      for (const url of Object.values(promptUrls)) URL.revokeObjectURL(url);
    },
  };
}
