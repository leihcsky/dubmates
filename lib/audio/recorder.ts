export async function requestMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

export function pickAudioMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function recordOnce(stream: MediaStream, maxMs: number) {
  const mimeType = pickAudioMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const chunks: Blob[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("stop", () => {
      resolve(
        new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }),
      );
    });
    recorder.addEventListener("error", () => {
      reject(new Error("Recording failed"));
    });
  });

  recorder.start(100);
  const timer = window.setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
  }, maxMs);

  return {
    stop() {
      window.clearTimeout(timer);
      if (recorder.state === "recording") recorder.stop();
    },
    done,
  };
}
