function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

export function createToneWav(durationSec: number, frequency: number) {
  const sampleRate = 44100;
  const samples = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples * 2, true);

  for (let i = 0; i < samples; i += 1) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.22;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
