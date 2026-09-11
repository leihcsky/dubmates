export type DubScoreBreakdown = {
  coverage: number;
  timing: number;
  energy: number;
  total: number;
  grade: "S" | "A" | "B" | "C" | "D";
  recorded: number;
  totalLines: number;
};

async function decodeDurationAndRms(blob: Blob): Promise<{ duration: number; rms: number }> {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const sample = data[i] ?? 0;
      sum += sample * sample;
    }
    return {
      duration: buffer.duration,
      rms: Math.sqrt(sum / Math.max(1, data.length)),
    };
  } catch {
    return { duration: 0, rms: 0 };
  } finally {
    await ctx.close();
  }
}

function gradeFromTotal(total: number): DubScoreBreakdown["grade"] {
  if (total >= 92) return "S";
  if (total >= 80) return "A";
  if (total >= 65) return "B";
  if (total >= 50) return "C";
  return "D";
}

export async function scoreDub(options: {
  lines: { id: string; start: number; end: number }[];
  takes: Record<string, Blob>;
}): Promise<DubScoreBreakdown> {
  const totalLines = options.lines.length;
  if (totalLines === 0) {
    return {
      coverage: 0,
      timing: 0,
      energy: 0,
      total: 0,
      grade: "D",
      recorded: 0,
      totalLines: 0,
    };
  }

  let recorded = 0;
  let timingSum = 0;
  let energySum = 0;
  let scored = 0;

  for (const line of options.lines) {
    const blob = options.takes[line.id];
    if (!blob) continue;
    recorded += 1;
    const expected = Math.max(0.35, line.end - line.start);
    const { duration, rms } = await decodeDurationAndRms(blob);
    if (duration <= 0) continue;
    scored += 1;
    const ratio = duration / expected;
    // Best around 0.85–1.25 of the original window.
    const timing =
      ratio >= 0.85 && ratio <= 1.25
        ? 100
        : ratio < 0.85
          ? Math.max(20, 100 - (0.85 - ratio) * 180)
          : Math.max(20, 100 - (ratio - 1.25) * 120);
    timingSum += timing;
    // Quiet takes score lower; very loud clips are fine up to a point.
    const energy = Math.max(15, Math.min(100, rms * 900));
    energySum += energy;
  }

  const coverage = (recorded / totalLines) * 100;
  const timing = scored ? timingSum / scored : 0;
  const energy = scored ? energySum / scored : 0;
  const total = Math.round(coverage * 0.45 + timing * 0.35 + energy * 0.2);

  return {
    coverage: Math.round(coverage),
    timing: Math.round(timing),
    energy: Math.round(energy),
    total,
    grade: gradeFromTotal(total),
    recorded,
    totalLines,
  };
}
