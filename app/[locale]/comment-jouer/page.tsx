import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";
import { localeLanguageAlternates, localizedUrlPath, routing, type Locale } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/utils";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "howto" });
  const site = getSiteUrl();
  const path = localizedUrlPath(locale, "/comment-jouer");
  const pageUrl = `${site}${path}`;
  const title = t("title");
  const description = t("metaDescription");

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: pageUrl,
      languages: localeLanguageAlternates(site, "/comment-jouer"),
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function HowToPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("howto");

  const needs = [t("need1"), t("need2"), t("need3")];
  const steps = [
    [t("s1t"), t("s1d")],
    [t("s2t"), t("s2d")],
    [t("s3t"), t("s3d")],
    [t("s4t"), t("s4d")],
  ] as const;
  const controls = [
    [t("cModeT"), t("cModeD")],
    [t("cHearT"), t("cHearD")],
    [t("cPreviewT"), t("cPreviewD")],
    [t("cRecordT"), t("cRecordD")],
    [t("cTakeT"), t("cTakeD")],
    [t("cNavT"), t("cNavD")],
    [t("cWaveT"), t("cWaveD")],
    [t("cExtraT"), t("cExtraD")],
  ] as const;
  const scoreItems = [t("score1"), t("score2"), t("score3")];
  const tips = [t("tip1"), t("tip2"), t("tip3"), t("tip4"), t("tip5")];

  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:py-16">
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{t("title")}</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted">{t("lead")}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/#play" size="lg">
          {t("cta")}
        </ButtonLink>
        <ButtonLink href="/packs" variant="outline" size="lg">
          {t("ctaSecondary")}
        </ButtonLink>
      </div>

      <Section title={t("needTitle")}>
        <ul className="list-disc space-y-2 pl-5 text-muted">
          {needs.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title={t("stepsTitle")}>
        <ol className="space-y-4">
          {steps.map(([title, body]) => (
            <li key={title} className="rounded-[22px] bg-surface p-5 card-shadow">
              <h3 className="font-display text-lg text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("controlsTitle")}>
        <dl className="space-y-3">
          {controls.map(([title, body]) => (
            <div key={title} className="rounded-[22px] bg-surface p-5 card-shadow">
              <dt className="font-semibold text-foreground">{title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t("scoreTitle")}>
        <p className="leading-relaxed text-muted">{t("scoreLead")}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
          {scoreItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">{t("scoreNote")}</p>
      </Section>

      <Section title={t("tipsTitle")}>
        <ul className="list-disc space-y-2 pl-5 text-muted">
          {tips.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/#play">{t("cta")}</ButtonLink>
        <ButtonLink href="/packs" variant="outline">
          {t("ctaSecondary")}
        </ButtonLink>
      </div>
    </main>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
