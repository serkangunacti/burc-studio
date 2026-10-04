export type VoiceTrack = { file: string; durationSeconds: number };
export type ReelsVoice = { intro: VoiceTrack; outro: VoiceTrack };
export function voiceTimeline(voice: ReelsVoice, frames: number, fps: number) {
  const introFrames = Math.ceil(voice.intro.durationSeconds * fps);
  const outroFrames = Math.ceil(voice.outro.durationSeconds * fps);
  if (introFrames + outroFrames >= frames) throw new Error('Konuşma videoya sığmıyor');
  return { introFrames, outroFrames, outroStart: frames - outroFrames };
}

export function musicVolume(frame: number, voice: ReelsVoice | undefined, frames: number, fps: number): number {
  if (!voice) return 1;
  const { introFrames, outroStart } = voiceTimeline(voice, frames, fps);
  // Konuşmada müziği düşür, ardından 0,4 sn içinde eski seviyesine getir.
  const ramp = Math.round(fps * 0.4);
  if (frame < introFrames || frame >= outroStart) return 0.2;
  return 0.2 + 0.8 * Math.min(1, (frame - introFrames) / ramp, (outroStart - frame) / ramp);
}
