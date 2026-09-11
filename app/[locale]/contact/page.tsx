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
  const path = localizedUrlPath(locale, "/contact");
  const url = `${site}${path}`;
  return {
    title: t("contactTitle"),
    description: t("contactMeta"),
    alternates: {
      canonical: url,
      languages: localeLanguageAlternates(site, "/contact"),
    },
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("legal");
  const paragraphs = t.raw("contactParagraphs") as string[];
  const email = t("contactEmail");
  const copyrightEmail = t("copyrightEmail");

  return (
    <LegalDoc title={t("contactTitle")} paragraphs={paragraphs}>
      <ul className="space-y-2 pt-2 text-foreground">
        <li>
          <span className="text-muted">{t("contactGeneralLabel")}: </span>
          <a className="font-semibold text-primary hover:underline" href={`mailto:${email}`}>
            {email}
          </a>
        </li>
        <li>
          <span className="text-muted">{t("contactCopyrightLabel")}: </span>
          <a
            className="font-semibold text-primary hover:underline"
            href={`mailto:${copyrightEmail}`}
          >
            {copyrightEmail}
          </a>
        </li>
      </ul>
    </LegalDoc>
  );
}

export function generateStaticParams() {
  return legalStaticParams();
}
