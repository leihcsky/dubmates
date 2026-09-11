"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function ComingSoonBanner() {
  const t = useTranslations("comingSoon");

  return (
    <div className="border-b border-[#ffc23d]/40 bg-[#fff6d8]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-sm text-[#b88200]">{t("title")}</p>
          <p className="text-sm text-muted">{t("body")}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/" locale="en">
            {t("cta")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function StudioClosed() {
  const t = useTranslations("studio");
  const soon = useTranslations("comingSoon");

  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl">{t("comingSoon")}</h1>
      <p className="mt-4 text-muted">{soon("body")}</p>
      <Button asChild className="mt-8">
        <Link href="/" locale="en">
          {soon("cta")}
        </Link>
      </Button>
    </main>
  );
}
