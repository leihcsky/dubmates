import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalDoc, legalStaticParams } from "@/components/legal/LegalDoc";
import { localeLanguageAlternates, localizedUrlPath, type Locale } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/utils";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "legal" });
  const site = getSiteUrl();
  const path = localizedUrlPath(locale, "/dmca");
  const url = `${site}${path}`;
  return {
    title: t("dmcaTitle"),
    description: t("dmcaMeta"),
    alternates: {
      canonical: url,
      languages: localeLanguageAlternates(site, "/dmca"),
    },
  };
}

export default async function DmcaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("legal");
  const paragraphs = t.raw("dmcaParagraphs") as string[];
  const copyrightEmail = t("copyrightEmail");

  return (
    <LegalDoc title={t("dmcaTitle")} paragraphs={paragraphs}>
      <p>
        <a
          className="font-semibold text-primary hover:underline"
          href={`mailto:${copyrightEmail}`}
        >
          {copyrightEmail}
        </a>
      </p>
      <p className="text-sm text-muted">{t("updated")}</p>
    </LegalDoc>
  );
}

export function generateStaticParams() {
  return legalStaticParams();
}
