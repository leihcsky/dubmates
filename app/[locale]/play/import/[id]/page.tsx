import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ImportedPlayClient } from "@/components/import/ImportedPlayClient";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Import — Dubmates",
};

export default async function ImportedPlayPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ImportedPlayClient />;
}
