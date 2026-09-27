import { Audio } from '@remotion/media';
import { staticFile, type CalculateMetadataFunction } from 'remotion';
import { REELS_FPS, REELS_SIZE, reelsDurationInFrames } from './reels';
import { FORMAT_SIZES, SLIDE_FPS, type ReelsProps, type SlideProps } from './slide-types';
import { getTemplate } from './templates';

// Sunucu tarafı render (otomatik paylaşım) için gönderinin kendi şablon sürümüyle çizilen genel bileşimler.
export type PostSlideProps = { templateVersion: string; props: SlideProps };
export type PostReelsProps = { templateVersion: string; reels: ReelsProps; musicFile: string | null };

export function PostSlide({ templateVersion, props }: PostSlideProps) {
  const { Slide } = getTemplate(templateVersion);
  return <Slide {...props} />;
}

export function PostReels({ templateVersion, reels, musicFile }: PostReelsProps) {
  const { Reels } = getTemplate(templateVersion);
  return (
    <>
      <Reels {...reels} />
      {musicFile && <Audio src={staticFile(musicFile)} />}
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
  durationInFrames: reelsDurationInFrames(props.reels.signs.length),
});
