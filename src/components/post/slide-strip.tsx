'use client';

import { cn } from '@/lib/utils';
import type { SlideData, SlideProps } from '@/remotion/slide-types';
import { SlideThumbnail } from './slide-thumbnail';

export function slideTitle(slide: SlideData): string {
  if (slide.type === 'cover') return 'Kapak';
  if (slide.type === 'cta') return 'Kapanış';
  return slide.signName;
}

export function SlideStrip({
  slides,
  templateVersion,
  selected,
  onSelect,
}: {
  slides: SlideProps[];
  templateVersion: string;
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ul aria-label="Slaytlar" className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
      {slides.map((props, index) => (
        <li key={index} className="w-[72vw] shrink-0 snap-center sm:w-64">
          <button
            type="button"
            aria-label={`Slayt ${index + 1}: ${slideTitle(props.slide)}`}
            aria-pressed={selected === index}
            onClick={() => onSelect(index)}
            className={cn(
              'block w-full overflow-hidden rounded-2xl border-2 transition-colors',
              selected === index ? 'border-primary' : 'border-transparent hover:border-border',
            )}
          >
            <SlideThumbnail templateVersion={templateVersion} props={props} />
          </button>
        </li>
      ))}
    </ul>
  );
}
