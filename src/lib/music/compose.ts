export type Voice = 'pad' | 'bass' | 'bell';
export type Note = { voice: Voice; start: number; duration: number; frequency: number; gain: number };
export type Score = { durationSeconds: number; rootFrequency: number; bpm: number; fadeIn: number; fadeOut: number; notes: Note[] };

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PENTATONIC = [0, 2, 4, 7, 9];
// A3'e (220 Hz) göre yarım ton; akorların sıcak ve çamurlaşmadan duyulduğu aralık.
const ROOT_OFFSETS = [-9, -7, -5, -4, -2, 0];
// Gam derecesi (0 = I) dizileri; yumuşak, çözülmeyen ve dönen ilerlemeler.
const PROGRESSIONS = [
  [0, 5, 3, 4],
  [0, 3, 5, 4],
  [5, 3, 0, 4],
  [0, 2, 3, 3],
];
const CHORDS = 8;
const PAD_GAIN = 0.05;
const BASS_GAIN = 0.12;
const BELL_DURATION = 2.4;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scaleSemitones(degree: number): number {
  return MAJOR[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);
}

const round = (value: number) => Math.round(value * 1000) / 1000;

export function musicSeed(reels: { variant: number; audience: 'kadin' | 'erkek' }): number {
  return reels.variant * 2 + (reels.audience === 'erkek' ? 1 : 0);
}

export function composeAmbient(seed: number, durationSeconds: number): Score {
  const random = mulberry32(seed);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const rootFrequency = 220 * 2 ** (pick(ROOT_OFFSETS) / 12);
  const at = (semitones: number) => rootFrequency * 2 ** (semitones / 12);
  const bpm = 62 + Math.floor(random() * 11);
  const beat = 60 / bpm;
  const progression = pick(PROGRESSIONS);
  const chordLength = durationSeconds / CHORDS;
  const notes: Note[] = [];

  for (let index = 0; index < CHORDS; index++) {
    const degree = progression[index % progression.length];
    const start = round(index * chordLength);
    // Akorlar bir sonrakine yumuşakça bağlansın diye biraz uzar; eserin sonunu aşmaz.
    const padDuration = round(Math.min(chordLength + 1.2, durationSeconds - start));
    for (const step of [0, 2, 4, 6]) {
      notes.push({ voice: 'pad', start, duration: padDuration, frequency: at(scaleSemitones(degree + step)), gain: PAD_GAIN });
    }
    notes.push({ voice: 'bass', start, duration: round(chordLength), frequency: at(scaleSemitones(degree) - 12), gain: BASS_GAIN });
  }

  const bellNotes = [...PENTATONIC.map((step) => step + 12), ...PENTATONIC.map((step) => step + 24)];
  let position = Math.floor(random() * 5);
  for (let time = beat * 2; time + BELL_DURATION <= durationSeconds - 1; time += beat) {
    if (random() >= 0.6) continue;
    position = Math.min(bellNotes.length - 1, Math.max(0, position + pick([-2, -1, 1, 2])));
    notes.push({ voice: 'bell', start: round(time), duration: BELL_DURATION, frequency: at(bellNotes[position]), gain: round(0.05 + random() * 0.02) });
  }

  return { durationSeconds, rootFrequency, bpm, fadeIn: 2.5, fadeOut: 3.5, notes };
}
