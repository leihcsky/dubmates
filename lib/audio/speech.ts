const LANG: Record<string, string> = {
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
};

export function speakLine(text: string, locale: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return () => undefined;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG[locale] ?? "fr-FR";
  utterance.rate = 1;

  const pickVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const prefix = utterance.lang.slice(0, 2);
    const match =
      voices.find((voice) => voice.lang.toLowerCase().startsWith(utterance.lang.toLowerCase())) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
    if (match) utterance.voice = match;
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    pickVoice();
  } else {
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice, {
      once: true,
    });
    window.setTimeout(pickVoice, 250);
  }

  return () => window.speechSynthesis.cancel();
}
