type EventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, props?: EventProps) {
  if (typeof window === "undefined") return;

  console.debug("[analytics]", event, props);

  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (gaId && typeof window.gtag === "function") {
    window.gtag("event", event, props);
  }
}
