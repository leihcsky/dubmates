export type PackLanguage = "en" | "fr" | "es" | "de";

export interface Character {
  id: string;
  name: string;
  color: string;
}

export interface DialogueLine {
  id: string;
  characterId: string;
  text: string;
  start: number;
  end: number;
  prompt?: string;
}

export interface PackScene {
  id: string;
  title: string;
  duration: number;
  thumbnail?: string;
  video: string;
  /** Some Dub Pack videos are silent; the preview then mixes backing + prompts. */
  videoHasAudio?: boolean;
  backing?: string;
  characters: Character[];
  lines: DialogueLine[];
}

export interface DubPack {
  id: string;
  slug: string;
  language: PackLanguage;
  title: string;
  description: string;
  category: string;
  thumbnail: string;
  scenes: PackScene[];
  comingSoon?: boolean;
}

export interface ResolvedScene extends PackScene {
  videoUrl: string;
  thumbnailUrl: string;
  backingUrl?: string;
  /** Present for imported community packs (often video/ogg). */
  videoMime?: string;
  /** Object URLs for original line prompt audio (imported packs). */
  promptUrls?: Record<string, string>;
}

export interface ResolvedPack extends DubPack {
  thumbnailUrl: string;
  scenes: ResolvedScene[];
}
