'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { graphemeLength } from '@/lib/text/turkish';
import { cn } from '@/lib/utils';

export function CharField({
  label,
  value,
  max,
  error,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  error?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const length = graphemeLength(value);
  const control = { id, value, 'aria-invalid': Boolean(error) || undefined };
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className={cn('text-xs tabular-nums', length > max ? 'text-destructive' : 'text-muted-foreground')}>
          {length}/{max}
        </span>
      </div>
      {rows ? (
        <Textarea {...control} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input {...control} onChange={(event) => onChange(event.target.value)} />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
