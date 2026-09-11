export interface StoredTake {
  packId: string;
  sceneId: string;
  lineId: string;
  blob: Blob;
  duration: number;
  createdAt: number;
}

const DB_NAME = "dubmates";
const STORE = "takes";
const VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE)) {
        db.deleteObjectStore(STORE);
      }
      db.createObjectStore(STORE, { keyPath: ["packId", "sceneId", "lineId"] });
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

export async function saveTake(take: StoredTake) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await reqToPromise(tx.objectStore(STORE).put(take));
  db.close();
}

export async function getTakes(packId: string, sceneId: string) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const all = await reqToPromise(tx.objectStore(STORE).getAll());
  db.close();
  const map: Record<string, StoredTake> = {};
  for (const take of all) {
    if (take.packId === packId && take.sceneId === sceneId) {
      map[take.lineId] = take;
    }
  }
  return map;
}
