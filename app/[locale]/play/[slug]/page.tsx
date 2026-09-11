import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StudioClosed } from "@/components/layout/ComingSoon";
import { StudioApp } from "@/components/studio/StudioApp";
import { isStudioLocale, type Locale } from "@/i18n/routing";
import { formatDuration } from "@/lib/utils";
import { getPackBySlug, getSceneById, isPackPlayable, resolvePack } from "@/lib/packs";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ scene?: string }>;
};

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Play — Dubmates",
};

export default async function PlayPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { scene: sceneId } = await searchParams;
  setRequestLocale(locale as Locale);
  const pack = getPackBySlug(slug);
  if (!pack) notFound();

  if (!isStudioLocale(locale) || !isPackPlayable(pack)) {
    return <StudioClosed />;
  }

  const resolved = resolvePack(pack);
  const needsPicker = resolved.scenes.length > 1 && !sceneId;
  if (needsPicker) {
    const t = await getTranslations("play");
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-sm uppercase tracking-wide text-muted">{pack.category}</p>
        <h1 className="mt-2 font-display text-4xl">{pack.title}</h1>
        <p className="mt-3 text-muted">{t("chooseScene")}</p>
        <ul className="mt-8 space-y-3">
          {resolved.scenes.map((scene) => (
            <li key={scene.id}>
              <Button asChild className="w-full justify-between" variant="outline" size="lg">
                <Link href={`/play/${pack.slug}?scene=${scene.id}`}>
                  <span>{scene.title}</span>
                  <span className="text-sm font-medium text-muted">
                    {formatDuration(scene.duration)}
                  </span>
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const scene = getSceneById(resolved, sceneId);
  if (!scene?.videoUrl) notFound();

  return <StudioApp pack={resolved} scene={scene} />;
}
