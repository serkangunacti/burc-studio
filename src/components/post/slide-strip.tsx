'use client';

import { Download, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
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
  onDownload,
  downloadDisabled,
}: {
  slides: SlideProps[];
  templateVersion: string;
  selected: number;
  onSelect: (index: number) => void;
  onDownload: (index: number) => Promise<void>;
  downloadDisabled: boolean;
}) {
  const [downloading, setDownloading] = useState<number | null>(null);

  async function download(index: number) {
    setDownloading(index);
    try {
      await onDownload(index);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <ul aria-label="Slaytlar" className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
      {slides.map((props, index) => (
        <li key={index} className="relative w-[72vw] shrink-0 snap-center sm:w-64">
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
          <button
            type="button"
            aria-label={`${slideTitle(props.slide)} slaytını indir`}
            title={downloadDisabled ? 'Önce değişiklikleri kaydet' : 'Bu slaytı JPEG olarak indir'}
            disabled={downloadDisabled || downloading !== null}
            onClick={() => void download(index)}
            className="absolute top-2 right-2 rounded-full bg-card/90 p-2 text-foreground shadow-sm transition-colors hover:bg-card disabled:opacity-50"
          >
            {downloading === index ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          </button>
        </li>
      ))}
    </ul>
  );
}
