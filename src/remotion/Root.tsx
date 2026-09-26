import { Composition } from 'remotion';
import { LONGEST_BODY, SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleSign } from './fixtures';
import { FORMAT_SIZES, SLIDE_FPS, type SlideProps } from './slide-types';
import { PastelSlide } from './templates/pastel-v1';

const SAMPLES: { id: string; props: SlideProps }[] = [
  { id: 'Kapak', props: sampleProps(SAMPLE_COVER) },
  { id: 'Burc-Koc', props: sampleProps(sampleSign('koc')) },
  { id: 'Burc-Erkek-Oglak', props: sampleProps(sampleSign('oglak', 'erkek')) },
  { id: 'Burc-EnUzun', props: sampleProps({ ...sampleSign('yay'), body: LONGEST_BODY }) },
  { id: 'Kapanis', props: sampleProps(SAMPLE_CTA) },
  { id: 'Burc-3x4', props: sampleProps(sampleSign('balik'), { format: '3x4' }) },
];

export function RemotionRoot() {
  return (
    <>
      {SAMPLES.map(({ id, props }) => (
        <Composition
          key={id}
          id={id}
          component={PastelSlide}
          durationInFrames={1}
          fps={SLIDE_FPS}
          width={FORMAT_SIZES[props.format].width}
          height={FORMAT_SIZES[props.format].height}
          defaultProps={props}
        />
      ))}
    </>
  );
}
