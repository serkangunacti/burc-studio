import { Audio } from '@remotion/media';
import { Sequence, staticFile, type CalculateMetadataFunction } from 'remotion';
import { REELS_FPS, REELS_SIZE, reelsDurationInFrames } from './reels';
import { FORMAT_SIZES, SLIDE_FPS, type ReelsProps, type SlideProps } from './slide-types';
import { getTemplate } from './templates';
import { musicVolume, voiceTimeline, type ReelsVoice } from './voice';

// Sunucu tarafı render (otomatik paylaşım) için gönderinin kendi şablon sürümüyle çizilen genel bileşimler.
export type PostSlideProps = { templateVersion: string; props: SlideProps };
export type PostReelsProps = { templateVersion: string; reels: ReelsProps; musicFile: string | null; voice?: ReelsVoice };

export function PostSlide({ templateVersion, props }: PostSlideProps) {
  const { Slide } = getTemplate(templateVersion);
  return <Slide {...props} />;
}

export function PostReels({ templateVersion, reels, musicFile, voice }: PostReelsProps) {
  const { Reels } = getTemplate(templateVersion);
  const frames = reelsDurationInFrames(reels.signs.length,reels.sceneTiming);
  const timeline = voice ? voiceTimeline(voice, frames, REELS_FPS,reels.sceneTiming) : null;
  return (
    <>
      <Reels {...reels} />
      {musicFile && <Audio src={staticFile(musicFile)} volume={frame => musicVolume(frame, voice, frames, REELS_FPS,reels.sceneTiming)} />}
      {voice && timeline && <>
        <Sequence from={0} durationInFrames={timeline.introFrames}><Audio src={staticFile(voice.intro.file)} /></Sequence>
        {timeline.signTracks?.map(track=><Sequence key={track.file} from={track.from} durationInFrames={track.durationInFrames}><Audio src={staticFile(track.file)} /></Sequence>)}
        <Sequence from={timeline.outroStart} durationInFrames={timeline.outroFrames}><Audio src={staticFile(voice.outro.file)} /></Sequence>
      </>}
    </>
  );
}

export const postSlideMetadata: CalculateMetadataFunction<PostSlideProps> = ({ props }) => ({
  ...FORMAT_SIZES[props.props.format],
  fps: SLIDE_FPS,
  durationInFrames: 1,
});

export const postReelsMetadata: CalculateMetadataFunction<PostReelsProps> = ({ props }) => ({
  ...REELS_SIZE,
  fps: REELS_FPS,
  durationInFrames: reelsDurationInFrames(props.reels.signs.length,props.reels.sceneTiming),
});
