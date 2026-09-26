import type { Note, Score } from './compose';
import { encodeWav } from './wav';

const SAMPLE_RATE = 44_100;
// Tek ses kaynağı müzik; her eser aynı seviyede (tepe ≈ −3 dB) duyulsun diye normalleştirilir.
const PEAK = 0.7;

function envelope(gain: GainNode, note: Note, attack: number, release: number) {
  const attackEnd = note.start + Math.min(attack, note.duration / 2);
  const releaseStart = Math.max(attackEnd, note.start + note.duration - release);
  gain.gain.setValueAtTime(0, note.start);
  gain.gain.linearRampToValueAtTime(note.gain, attackEnd);
  gain.gain.setValueAtTime(note.gain, releaseStart);
  gain.gain.linearRampToValueAtTime(0, note.start + note.duration);
}

function oscillator(context: BaseAudioContext, type: OscillatorType, frequency: number, detune: number, output: AudioNode, note: Note) {
  const node = context.createOscillator();
  node.type = type;
  node.frequency.value = frequency;
  node.detune.value = detune;
  node.connect(output);
  node.start(note.start);
  node.stop(note.start + note.duration + 0.05);
}

function playPad(context: BaseAudioContext, note: Note, output: AudioNode) {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  filter.Q.value = 0.5;
  const gain = context.createGain();
  envelope(gain, note, 1.8, 1.5);
  filter.connect(gain).connect(output);
  oscillator(context, 'triangle', note.frequency, -6, filter, note);
  oscillator(context, 'triangle', note.frequency, 6, filter, note);
}

function playBass(context: BaseAudioContext, note: Note, output: AudioNode) {
  const gain = context.createGain();
  envelope(gain, note, 1.2, 1.2);
  gain.connect(output);
  oscillator(context, 'sine', note.frequency, 0, gain, note);
}

// Çan: vuruşla başlayıp üstel sönen üç harmonik.
function playBell(context: BaseAudioContext, note: Note, output: AudioNode) {
  for (const [ratio, level] of [
    [1, 1],
    [2, 0.3],
    [3, 0.12],
  ]) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, note.start);
    gain.gain.linearRampToValueAtTime(note.gain * level, note.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, note.start + note.duration);
    gain.connect(output);
    oscillator(context, 'sine', note.frequency * ratio, 0, gain, note);
  }
}

// Tohumlu gürültüden üretilen yankı; aynı eser her tarayıcıda aynı mekânda çalar.
function reverbImpulse(context: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(2, Math.round(seconds * context.sampleRate), context.sampleRate);
  let state = 12_345;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index++) {
      state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
      data[index] = ((state / 4_294_967_296) * 2 - 1) * (1 - index / data.length) ** 3;
    }
  }
  return buffer;
}

export async function renderScoreToWav(score: Score): Promise<Blob> {
  const context = new OfflineAudioContext(2, Math.round(score.durationSeconds * SAMPLE_RATE), SAMPLE_RATE);
  const master = context.createGain();
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(1, score.fadeIn);
  master.gain.setValueAtTime(1, score.durationSeconds - score.fadeOut);
  master.gain.linearRampToValueAtTime(0, score.durationSeconds);
  master.connect(context.destination);

  const dry = context.createGain();
  dry.gain.value = 0.8;
  dry.connect(master);
  const reverb = context.createConvolver();
  reverb.buffer = reverbImpulse(context, 3);
  const wet = context.createGain();
  wet.gain.value = 0.35;
  reverb.connect(wet).connect(master);
  const bus = context.createGain();
  bus.connect(dry);
  bus.connect(reverb);

  for (const note of score.notes) {
    if (note.voice === 'pad') playPad(context, note, bus);
    else if (note.voice === 'bass') playBass(context, note, bus);
    else playBell(context, note, bus);
  }

  const rendered = await context.startRendering();
  const channels = [rendered.getChannelData(0), rendered.getChannelData(1)];
  const peak = Math.max(...channels.map((data) => data.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0)));
  if (peak > 0) for (const data of channels) for (let index = 0; index < data.length; index++) data[index] *= PEAK / peak;
  return new Blob([encodeWav(channels, SAMPLE_RATE)], { type: 'audio/wav' });
}
