import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Manrope, Unbounded } from "next/font/google";
import { notFound } from "next/navigation";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { ComingSoonBanner } from "@/components/layout/ComingSoon";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome";
import { isStudioLocale, localeLanguageAlternates, localizedUrlPath, routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/utils";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const site = getSiteUrl();
  const titles: Record<string, string> = {
    en: "The Choicer Voicer online in your browser | Dubmates",
    fr: "Jeu de doublage en ligne gratuit | Dubmates",
    es: "Juego de doblaje online gratis | Dubmates",
    de: "Kostenloses Vertonungsspiel online | Dubmates",
  };
  const descriptions: Record<string, string> = {
    en: "Play The Choicer Voicer online for free in your browser. Pick a dub scene, record with your mic, then watch and download — no signup.",
    fr: "Dubmates est un jeu de doublage en ligne gratuit : double des scènes au micro, crée une vidéo drôle et télécharge-la pour la partager — dans le navigateur, sans compte.",
    es: "Dubmates es un juego de doblaje online gratis: elige una escena, graba tu voz y descarga el vídeo en el navegador, sin cuenta.",
    de: "Dubmates ist ein kostenloses Vertonungsspiel online: Szene wählen, einsprechen, Video herunterladen — im Browser, ohne Konto.",
  };

  return {
    metadataBase: new URL(site),
    title: {
      default: titles[locale] ?? titles.en,
      template: "%s · Dubmates",
    },
    description: descriptions[locale] ?? descriptions.en,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
    alternates: {
      canonical: (() => {
        const path = localizedUrlPath(locale);
        return `${site}${path === "/" ? "" : path}`;
      })(),
      languages: localeLanguageAlternates(site),
    },
    openGraph: {
      title: titles[locale] ?? titles.en,
      description: descriptions[locale] ?? descriptions.en,
      locale,
      type: "website",
      siteName: "Dubmates",
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${unbounded.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <NextIntlClientProvider messages={messages}>
          <div className="flex min-h-full flex-col">
            <SiteHeader />
            {!isStudioLocale(locale) ? <ComingSoonBanner /> : null}
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </NextIntlClientProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
