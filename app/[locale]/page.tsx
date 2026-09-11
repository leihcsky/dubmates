import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { HomePlayArena, type CatalogPackOption } from "@/components/home/HomePlayArena";
import {
  isStudioLocale,
  localeLanguageAlternates,
  localizedUrlPath,
  routing,
  type Locale,
} from "@/i18n/routing";
import {
  getAllPacks,
  getPackDuration,
  isPackPlayable,
  resolvePack,
} from "@/lib/packs";
import { getSiteUrl } from "@/lib/utils";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "meta" });
  const site = getSiteUrl();
  const title = t("title");
  const description = t("description");
  const pagePath = localizedUrlPath(locale);
  const pageUrl = `${site}${pagePath === "/" ? "" : pagePath}`;

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: pageUrl,
      languages: localeLanguageAlternates(site),
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

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("home");
  const packs = getAllPacks().filter((pack) => isPackPlayable(pack));
  const playable = isStudioLocale(locale);
  const catalog: CatalogPackOption[] = packs.map((pack) => {
    const resolved = resolvePack(pack);
    const scene = resolved.scenes[0];
    return {
      slug: pack.slug,
      title: pack.title,
      description: pack.description,
      category: pack.category,
      lineCount: scene?.lines.length ?? 0,
      duration: getPackDuration(pack),
      thumbnailUrl: resolved.thumbnailUrl,
      pack: resolved,
    };
  });
  const defaultPack = catalog[0] ?? null;

  const faqs = [
    [t("faq1q"), t("faq1a")],
    [t("faq2q"), t("faq2a")],
    [t("faq3q"), t("faq3a")],
    [t("faq4q"), t("faq4a")],
    [t("faq5q"), t("faq5a")],
    [t("faq6q"), t("faq6a")],
    [t("faq7q"), t("faq7a")],
    [t("faq8q"), t("faq8a")],
    [t("faq9q"), t("faq9a")],
  ] as const;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };

  const howSteps =
    locale === "en"
      ? ([
          [t("s1t"), t("s1d")],
          [t("s2t"), t("s2d")],
          [t("s3t"), t("s3d")],
          [t("s4t"), t("s4d")],
          [t("s5t"), t("s5d")],
        ] as const)
      : ([
          [t("s1t"), t("s1d")],
          [t("s2t"), t("s2d")],
          [t("s3t"), t("s3d")],
        ] as const);

  const whatSection = (
    <section key="what" className="px-4 pb-10 pt-4">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-2xl sm:text-3xl">{t("whatTitle")}</h2>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-muted">
          <p>{t("whatBody")}</p>
          <p>{t("whatResult")}</p>
          <p>{t("whatShare")}</p>
        </div>
      </div>
    </section>
  );

  const howSection = (
    <section key="how" className="px-4 pb-10">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-2xl">{t("howTitle")}</h2>
        <ol
          className={
            locale === "en"
              ? "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "mt-6 grid gap-4 sm:grid-cols-3"
          }
        >
          {howSteps.map(([title, body]) => (
            <li key={title} className="rounded-[22px] bg-surface p-5 card-shadow">
              <h3 className="font-display text-lg">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ButtonLink href="/#play">{t("ctaPlay")}</ButtonLink>
          <Link href="/packs" className="text-sm font-semibold text-sky hover:underline">
            {t("packsLink")}
          </Link>
        </div>
        <p className="mt-5">
          <Link
            href="/comment-jouer"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t("fullGuide")}
          </Link>
        </p>
      </div>
    </section>
  );

  const micSection = (
    <section key="mic" className="px-4 pb-10">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-2xl">{t("micTitle")}</h2>
        <div className="mt-4 space-y-4 text-base leading-relaxed text-muted">
          <p>{t("micBody")}</p>
          <p>{t("micBody2")}</p>
        </div>
        <p className="mt-4">
          <Link href="/privacy" className="text-sm font-semibold text-sky hover:underline">
            {t("micPrivacy")}
          </Link>
        </p>
      </div>
    </section>
  );

  const browserSection = (
    <section key="browser" className="px-4 pb-10">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-2xl">{t("browserTitle")}</h2>
        <p className="mt-4 leading-relaxed text-muted">{t("browserLead")}</p>
        <ul className="mt-5 list-disc space-y-2 pl-5 text-muted">
          {[t("browser1"), t("browser2"), t("browser3"), t("browser4"), t("browser5")].map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
      </div>
    </section>
  );

  const whySection = (
    <section key="why" className="px-4 pb-10">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-2xl">{t("whyTitle")}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            [t("why1t"), t("why1d")],
            [t("why2t"), t("why2d")],
            [t("why3t"), t("why3d")],
            [t("why4t"), t("why4d")],
          ].map(([title, body]) => (
            <li key={title} className="rounded-[22px] bg-surface p-5 card-shadow">
              <h3 className="font-display text-lg">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );

  const scoreSection = (
    <section key="score" className="px-4 pb-10">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-2xl">{t("scoreTitle")}</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted">{t("scoreLead")}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            [t("scoreCoverageT"), t("scoreCoverageD")],
            [t("scoreTimingT"), t("scoreTimingD")],
            [t("scoreEnergyT"), t("scoreEnergyD")],
          ].map(([title, body]) => (
            <li key={title} className="rounded-[22px] bg-surface p-5 card-shadow">
              <h3 className="font-display text-lg">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-muted">{t("scoreNote")}</p>
      </div>
    </section>
  );

  const cvSection = (
    <section key="cv" className="px-4 pb-10 pt-4">
      <div className="mx-auto max-w-4xl rounded-[22px] bg-surface p-6 card-shadow sm:p-8">
        <h2 className="font-display text-2xl">{t("cvTitle")}</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted sm:text-base">
          <p>{t("cvBody")}</p>
          <p>{t("cvAlt")}</p>
        </div>
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-2 text-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">{t("cvColFeature")}</th>
                <th className="px-3 py-2 font-semibold">{t("cvColDesk")}</th>
                <th className="px-3 py-2 font-semibold">{t("cvColDm")}</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-b border-border">
                <td className="px-3 py-2 font-semibold text-foreground">{t("cvRowInstall")}</td>
                <td className="px-3 py-2">{t("cvRowInstallDesk")}</td>
                <td className="px-3 py-2">{t("cvRowInstallDm")}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2 font-semibold text-foreground">{t("cvRowPlay")}</td>
                <td className="px-3 py-2">{t("cvRowPlayDesk")}</td>
                <td className="px-3 py-2">{t("cvRowPlayDm")}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-semibold text-foreground">{t("cvRowExport")}</td>
                <td className="px-3 py-2">{t("cvRowExportDesk")}</td>
                <td className="px-3 py-2">{t("cvRowExportDm")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6">
          <ButtonLink href="/#play">{t("cvCta")}</ButtonLink>
        </div>
      </div>
    </section>
  );

  const faqSection = (
    <section key="faq" className="px-4 pb-14">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-2xl">{t("faqTitle")}</h2>
        <dl className="mt-6 space-y-4">
          {faqs.map(([question, answer]) => (
            <div key={question} className="rounded-[22px] bg-surface p-5 card-shadow">
              <dt className="font-display text-lg text-foreground">{question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{answer}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink href="/#play">{t("ctaPlay")}</ButtonLink>
          <Link href="/comment-jouer" className="text-sm font-semibold text-sky hover:underline">
            {t("moreHow")}
          </Link>
          <Link href="/packs" className="text-sm font-semibold text-primary hover:underline">
            {t("packsLink")}
          </Link>
        </div>
      </div>
    </section>
  );

  /** EN: thicker CV-intent page (inspired by browser studio competitors). */
  const contentSections =
    locale === "en"
      ? [
          cvSection,
          whatSection,
          howSection,
          micSection,
          browserSection,
          whySection,
          scoreSection,
          faqSection,
        ]
      : [whatSection, howSection, whySection, scoreSection, cvSection, faqSection];

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="mx-auto max-w-4xl px-4 pb-2 pt-6 sm:pt-8">
        <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          {t("h1")}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
          {t("lead")}
        </p>
      </section>

      <HomePlayArena playable={playable} defaultPack={defaultPack} catalog={catalog} />

      {contentSections}
    </main>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
