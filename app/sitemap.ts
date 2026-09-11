import type { MetadataRoute } from "next";
import { localizedUrlPath, routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  const staticPaths = [
    "",
    "/packs",
    "/comment-jouer",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/dmca",
  ];
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const path of staticPaths) {
      const localized = localizedUrlPath(locale, path);
      entries.push({
        url: `${site}${localized === "/" ? "" : localized}`,
        lastModified: new Date(),
      });
    }
  }

  return entries;
}
