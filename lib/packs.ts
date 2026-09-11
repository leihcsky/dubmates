import typeInChat from "@/content/packs/type-in-chat/pack.json";
import electricBlanket from "@/content/packs/electric-blanket/pack.json";
import legoBatmanSanta from "@/content/packs/lego-batman-santa/pack.json";
import heisenburger from "@/content/packs/heisenburger/pack.json";
import type {
  DubPack,
  PackLanguage,
  PackScene,
  ResolvedPack,
  ResolvedScene,
} from "@/lib/pack-types";

/** Community Dub Packs adapted for the browser catalog. First item is the homepage default. */
const playable: DubPack[] = [
  typeInChat as DubPack,
  electricBlanket as DubPack,
  legoBatmanSanta as DubPack,
  heisenburger as DubPack,
];

export function getAllPacks(): DubPack[] {
  return [...playable];
}

export function getPacksByLocale(locale: PackLanguage): DubPack[] {
  return getAllPacks().filter((pack) => pack.language === locale);
}

export function getPackBySlug(slug: string): DubPack | undefined {
  return getAllPacks().find((pack) => pack.slug === slug);
}

export function getPackDuration(pack: DubPack) {
  return pack.scenes.reduce((sum, scene) => sum + scene.duration, 0);
}

export function isPackPlayable(pack: DubPack) {
  return !pack.comingSoon && pack.scenes.some((scene) => Boolean(scene.video));
}

function resolveScene(packSlug: string, scene: PackScene): ResolvedScene {
  const base = `/packs/${packSlug}`;
  const promptUrls: Record<string, string> = {};
  for (const line of scene.lines) {
    if (line.prompt) {
      promptUrls[line.id] = `${base}/${line.prompt}`;
    }
  }
  return {
    ...scene,
    videoUrl: scene.video ? `${base}/${scene.video}` : "",
    thumbnailUrl: scene.thumbnail ? `${base}/${scene.thumbnail}` : "",
    backingUrl: scene.backing ? `${base}/${scene.backing}` : undefined,
    promptUrls: Object.keys(promptUrls).length ? promptUrls : undefined,
  };
}

export function resolvePack(pack: DubPack): ResolvedPack {
  const base = `/packs/${pack.slug}`;
  return {
    ...pack,
    thumbnailUrl: pack.thumbnail ? `${base}/${pack.thumbnail}` : "",
    scenes: pack.scenes.map((scene) => resolveScene(pack.slug, scene)),
  };
}

export function getSceneById(pack: ResolvedPack, sceneId?: string) {
  if (sceneId) {
    return pack.scenes.find((scene) => scene.id === sceneId);
  }
  return pack.scenes[0];
}
