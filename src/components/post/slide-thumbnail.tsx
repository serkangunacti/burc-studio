'use client';

import { Thumbnail } from '@remotion/player';
import { FORMAT_SIZES, SLIDE_FPS, type SlideProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';

export function SlideThumbnail({ templateVersion, props }: { templateVersion: string; props: SlideProps }) {
  const { width, height } = FORMAT_SIZES[props.format];
  return (
    <Thumbnail
      component={getTemplate(templateVersion).Slide}
      inputProps={props}
      compositionWidth={width}
      compositionHeight={height}
      durationInFrames={1}
      fps={SLIDE_FPS}
      frameToDisplay={0}
      style={{ width: '100%' }}
    />
  );
}
