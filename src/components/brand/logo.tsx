import { SaturnMark } from '@/lib/brand/saturn-mark';
import { cn } from '@/lib/utils';

export function Logo({ className, markSize = 30, planetFill }: { className?: string; markSize?: number; planetFill: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-heading', className)}>
      <SaturnMark size={markSize} color="currentColor" strokeWidth={5} starColor="#C9A96E" planetFill={planetFill} label="kozmikarkan logosu" />
      <span>kozmikarkan</span>
    </span>
  );
}
