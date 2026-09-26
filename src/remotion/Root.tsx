import { Composition } from 'remotion';
import { LONGEST_BODY, LONGEST_SHORT, LONGEST_WEEKLY_BODY, SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleReels, sampleSign } from './fixtures';
import { REELS_FPS, REELS_SIZE, reelsDurationInFrames } from './reels';
import { FORMAT_SIZES, SLIDE_FPS, type SlideProps } from './slide-types';
import { PastelSlide } from './templates/pastel-v1';
import { PastelReels } from './templates/pastel-v1-reels';
import { PastelWeeklySlide } from './templates/pastel-weekly-v1';

const SAMPLES: { id: string; props: SlideProps }[] = [
  { id: 'Kapak', props: sampleProps(SAMPLE_COVER) },
  { id: 'Burc-Koc', props: sampleProps(sampleSign('koc')) },
  { id: 'Burc-Erkek-Oglak', props: sampleProps(sampleSign('oglak', 'erkek')) },
  { id: 'Burc-EnUzun', props: sampleProps({ ...sampleSign('yay'), body: LONGEST_BODY }) },
  { id: 'Kapanis', props: sampleProps(SAMPLE_CTA) },
  { id: 'Burc-3x4', props: sampleProps(sampleSign('balik'), { format: '3x4' }) },
];

const WEEK = '28 EYLÜL – 4 EKİM';
const WEEKLY_SAMPLES: { id: string; props: SlideProps }[] = [
  { id: 'Haftalik-Kapak', props: sampleProps({ ...SAMPLE_COVER, dateLabel: WEEK, hook: 'Bu hafta yıldızlar sana yeni bir kapı açıyor ✨' }, { variant: 6 }) },
  { id: 'Haftalik-Burc-EnUzun', props: sampleProps({ ...sampleSign('yay'), dateLabel: WEEK, body: LONGEST_WEEKLY_BODY }, { variant: 6 }) },
  { id: 'Haftalik-Erkek-EnUzun-3x4', props: sampleProps({ ...sampleSign('kova', 'erkek'), dateLabel: WEEK, body: LONGEST_WEEKLY_BODY }, { variant: 9, format: '3x4' }) },
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
      {WEEKLY_SAMPLES.map(({ id, props }) => (
        <Composition
          key={id}
          id={id}
          component={PastelWeeklySlide}
          durationInFrames={1}
          fps={SLIDE_FPS}
          width={FORMAT_SIZES[props.format].width}
          height={FORMAT_SIZES[props.format].height}
          defaultProps={props}
        />
      ))}
      {(
        [
          ['Reels-Kadin', sampleReels('kadin')],
          ['Reels-Erkek', { ...sampleReels('erkek'), variant: 3 }],
          ['Reels-EnUzun', { ...sampleReels(), signs: sampleReels().signs.map((sign) => ({ ...sign, headline: 'Çığır açan, güçlü bir gün geçireceksin!!', short: LONGEST_SHORT })) }],
        ] as const
      ).map(([id, reels]) => (
        <Composition
          key={id}
          id={id}
          component={PastelReels}
          durationInFrames={reelsDurationInFrames(reels.signs.length)}
          fps={REELS_FPS}
          width={REELS_SIZE.width}
          height={REELS_SIZE.height}
          defaultProps={reels}
        />
      ))}
    </>
  );
}
