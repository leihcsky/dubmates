type EventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Override with NEXT_PUBLIC_GA_ID; empty env still falls back to the live property. */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_ID?.trim() || "G-RQXXH287MV";

export function track(event: string, props?: EventProps) {
  if (typeof window === "undefined") return;

  console.debug("[analytics]", event, props);

  if (GA_MEASUREMENT_ID && typeof window.gtag === "function") {
    window.gtag("event", event, props);
  }
}
