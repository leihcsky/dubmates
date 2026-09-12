import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";
import { PackCard } from "@/components/packs/PackCard";
import {
  isStudioLocale,
  localeLanguageAlternates,
  localizedUrlPath,
  routing,
  type Locale,
} from "@/i18n/routing";
import { getAllPacks, getPackDuration } from "@/lib/packs";
import { getSiteUrl } from "@/lib/utils";

type Props = { params: Promise<{ locale: string }> };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OutLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "packs" });
  const site = getSiteUrl();
  const path = localizedUrlPath(locale, "/packs");
  const pageUrl = `${site}${path}`;
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: pageUrl,
      languages: localeLanguageAlternates(site, "/packs"),
    },
    openGraph: {
      title,
      description,
      locale,
      type: "website",
      siteName: "Dubmates",
      url: pageUrl,
    },
  };
}

export default async function PacksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("packs");
  const packs = getAllPacks();
  const playable = isStudioLocale(locale);
  const site = getSiteUrl();
  const pageUrl = `${site}${localizedUrlPath(locale, "/packs")}`;
  const minutes = Math.max(1, Math.round(packs.reduce((sum, pack) => sum + getPackDuration(pack), 0) / 60));

  const inside = [
    [t("inside1t"), t("inside1d")],
    [t("inside2t"), t("inside2d")],
    [t("inside3t"), t("inside3d")],
  ] as const;
  const steps = [
    [t("play1t"), t("play1d")],
    [t("play2t"), t("play2d")],
    [t("play3t"), t("play3d")],
  ] as const;
  const faqs = [
    [t("faq1q"), t("faq1a")],
    [t("faq2q"), t("faq2a")],
    [t("faq3q"), t("faq3a")],
    [t("faq4q"), t("faq4a")],
    [t("faq5q"), t("faq5a")],
  ] as const;

  return (
    <main className="mx-auto max-w-6xl px-4 py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: t("title"),
            description: t("metaDescription"),
            url: pageUrl,
            numberOfItems: packs.length,
            isPartOf: { "@type": "WebSite", name: "Dubmates", url: site },
          }),
        }}
      />

      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{t("title")}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">{t("subtitle")}</p>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted">{t("intro")}</p>
      <p className="mt-3 max-w-3xl text-sm text-muted">{t("disclaimer")}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/#play" size="lg">
          {t("playCta")}
        </ButtonLink>
        <ButtonLink href="/comment-jouer" variant="outline" size="lg">
          {t("playGuide")}
        </ButtonLink>
      </div>

      <Section title={t("catalogTitle")}>
        <p className="max-w-3xl leading-relaxed text-muted">
          {t("catalogLead", { count: packs.length, minutes })}
        </p>
        {packs.length === 0 ? (
          <p className="mt-8 text-muted">{t("empty")}</p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => (
              <PackCard key={pack.id} pack={pack} playable={playable} />
            ))}
          </div>
        )}
      </Section>

      <Section title={t("insideTitle")}>
        <p className="max-w-3xl leading-relaxed text-muted">{t("insideLead")}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {inside.map(([title, body]) => (
            <li key={title} className="rounded-[22px] bg-surface p-5 card-shadow">
              <h3 className="font-display text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("playTitle")}>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map(([title, body]) => (
            <li key={title} className="rounded-[22px] bg-surface p-5 card-shadow">
              <h3 className="font-display text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("importTitle")}>
        <p className="max-w-3xl leading-relaxed text-muted">
          {t.rich("importBody", {
            gamebanana: (chunks) => (
              <OutLink href="https://gamebanana.com/mods/cats/44064">{chunks}</OutLink>
            ),
            choicer: (chunks) => <OutLink href="https://choicervoicer.com/">{chunks}</OutLink>,
          })}
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{t("importNote")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/#play">{t("importCta")}</ButtonLink>
        </div>
      </Section>

      <Section title={t("faqTitle")}>
        <dl className="space-y-3">
          {faqs.map(([question, answer]) => (
            <div key={question} className="rounded-[22px] bg-surface p-5 card-shadow">
              <dt className="font-semibold text-foreground">{question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </main>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
