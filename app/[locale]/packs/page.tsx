import { getTranslations, setRequestLocale } from "next-intl/server";
import { PackCard } from "@/components/packs/PackCard";
import { isStudioLocale, routing, type Locale } from "@/i18n/routing";
import { getAllPacks } from "@/lib/packs";

type Props = { params: Promise<{ locale: string }> };

export default async function PacksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("packs");
  const packs = getAllPacks();
  const playable = isStudioLocale(locale);

  return (
    <main className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="font-display text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t("subtitle")}</p>
      {packs.length === 0 ? (
        <p className="mt-10 text-muted">{t("empty")}</p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} playable={playable} />
          ))}
        </div>
      )}
    </main>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
