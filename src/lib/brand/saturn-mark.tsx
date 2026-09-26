const RING_BACK = 'M10 63 A42 13 -18 0 1 90 37';
const RING_FRONT = 'M90 37 A42 13 -18 0 1 10 63';
const STAR = 'M80 8 C81 15 83 17 90 18 C83 19 81 21 80 28 C79 21 77 19 70 18 C77 17 79 15 80 8 Z';

// kozmikarkan logosu: halkalı gezegen ve altın yıldız. Halkanın arka yarısı gezegenin arkasında kalsın diye
// büyük boyutlarda gezegen zemin rengiyle doldurulur; filigran boyutunda dolgu gerekmez.
export function SaturnMark({
  size,
  color,
  strokeWidth,
  starColor,
  planetFill = 'none',
  label,
}: {
  size: number;
  color: string;
  strokeWidth: number;
  starColor?: string;
  planetFill?: string;
  label?: string;
}) {
  return (
    <svg
      data-mark="saturn"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={RING_BACK} />
      <circle cx={50} cy={50} r={19} fill={planetFill} />
      <path d={RING_FRONT} />
      {starColor && <path d={STAR} fill={starColor} stroke="none" />}
    </svg>
  );
}
