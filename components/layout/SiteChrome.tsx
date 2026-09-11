"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-40 px-4 pt-3">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-2xl bg-surface px-3 card-shadow sm:h-16 sm:gap-6 sm:px-5">
        <Link href="/" className="shrink-0 font-display text-base tracking-tight text-foreground sm:text-lg">
          DUB<span className="text-primary">MATES</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-semibold text-muted sm:flex">
          <Link href="/packs" className="hover:text-foreground">
            {t("packs")}
          </Link>
          <Link href="/comment-jouer" className="hover:text-foreground">
            {t("howTo")}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          <Link
            href="/#play"
            className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-bold text-white hover:bg-primary-hover sm:h-10 sm:px-5"
          >
            {t("play")}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="px-4 pb-8 pt-10">
      <div className="mx-auto max-w-6xl rounded-[28px] bg-surface px-5 py-8 text-sm text-muted card-shadow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className="font-display text-base tracking-tight text-foreground sm:text-lg"
            >
              DUB<span className="text-primary">MATES</span>
            </Link>
            <p className="mt-1">{t("tagline")}</p>
            <p className="mt-2 max-w-md">{t("privacyNote")}</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/packs" className="hover:text-primary">
              {t("packs")}
            </Link>
            <Link href="/comment-jouer" className="hover:text-primary">
              {t("howTo")}
            </Link>
            <Link href="/about" className="hover:text-primary">
              {t("about")}
            </Link>
            <Link href="/contact" className="hover:text-primary">
              {t("contact")}
            </Link>
            <Link href="/privacy" className="hover:text-primary">
              {t("privacy")}
            </Link>
            <Link href="/terms" className="hover:text-primary">
              {t("terms")}
            </Link>
            <Link href="/dmca" className="hover:text-primary">
              {t("dmca")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
