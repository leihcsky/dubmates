import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

/** Legacy French path → /privacy */
export default async function ConfidentialiteRedirect({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  redirect({ href: "/privacy", locale: locale as Locale });
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
