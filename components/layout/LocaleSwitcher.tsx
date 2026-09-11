"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { switcherLocales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LABELS: Record<(typeof switcherLocales)[number], string> = {
  en: "EN",
  fr: "FR",
};

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      className={cn("flex items-center gap-0.5 rounded-xl bg-surface-2 p-0.5", className)}
      role="navigation"
      aria-label={t("language")}
    >
      {switcherLocales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            aria-current={active ? "page" : undefined}
            className={cn(
              "cursor-pointer rounded-lg px-2 py-1 text-xs font-bold tracking-wide transition-colors sm:px-2.5",
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
            onClick={() => {
              if (!active) router.replace(pathname, { locale: code });
            }}
          >
            {LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
