import { defineRouting } from "next-intl/routing";

export const locales = ["en", "fr", "es", "de"] as const;
export type Locale = (typeof locales)[number];

/** Locales where the dubbing studio is fully open. */
export const studioLocales = ["en", "fr"] as const;

/** Locales shown in the header language switcher (hide unfinished ones). */
export const switcherLocales = ["en", "fr"] as const;

export function isStudioLocale(locale: string): locale is (typeof studioLocales)[number] {
  return (studioLocales as readonly string[]).includes(locale);
}

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  /** English (default) has no `/en` prefix; other locales keep `/fr`, `/es`, `/de`. */
  localePrefix: "as-needed",
});

/** Public URL path for a locale + path (path like `/packs` or ``). */
export function localizedUrlPath(locale: string, path = "") {
  const suffix = path.startsWith("/") || path === "" ? path : `/${path}`;
  if (locale === routing.defaultLocale) {
    return suffix || "/";
  }
  return `/${locale}${suffix}`;
}

export function localeLanguageAlternates(site: string, path = "") {
  const suffix = path.startsWith("/") || path === "" ? path : `/${path}`;
  return {
    en: `${site}${suffix || ""}`,
    fr: `${site}/fr${suffix}`,
    es: `${site}/es${suffix}`,
    de: `${site}/de${suffix}`,
    "x-default": `${site}${suffix || ""}`,
  } as const;
}
