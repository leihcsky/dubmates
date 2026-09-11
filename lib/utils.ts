import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Base URL for official pack media on R2/CDN (no trailing slash).
 * Paths stay `/packs/<slug>/…` under this host.
 */
export function getPacksCdnBase() {
  const raw = process.env.NEXT_PUBLIC_PACKS_CDN?.trim();
  if (raw === "") return "";
  return (raw || "https://cdn.dubmates.org").replace(/\/$/, "");
}

/** Absolute or site-relative URL for a file under `public/packs/<slug>/`. */
export function packAssetUrl(packSlug: string, fileName: string) {
  const path = `/packs/${packSlug}/${fileName}`;
  const base = getPacksCdnBase();
  return base ? `${base}${path}` : path;
}
