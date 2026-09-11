import { routing } from "@/i18n/routing";

type Props = {
  title: string;
  paragraphs: string[];
  children?: React.ReactNode;
};

export function LegalDoc({ title, paragraphs, children }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:py-16">
      <h1 className="font-display text-4xl tracking-tight">{title}</h1>
      <div className="mt-8 space-y-4 text-base leading-relaxed text-muted">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {children}
      </div>
    </main>
  );
}

export function legalStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
