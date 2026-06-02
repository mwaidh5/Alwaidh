type Props = {
  rating: number;        // 0..5
  showValue?: boolean;   // append numeric value, e.g. "4.6"
  className?: string;
};

/**
 * Five stars with accurate fractional fill, drawn by overlaying a gold star
 * row clipped to the rating percentage on top of a grey star row.
 */
export default function StarRating({ rating, showValue = false, className = '' }: Props) {
  const pct = (Math.max(0, Math.min(5, rating)) / 5) * 100;
  const stars = '★★★★★';

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative inline-block whitespace-nowrap text-sm leading-none">
        <span className="text-slate-300">{stars}</span>
        <span
          className="absolute inset-0 overflow-hidden whitespace-nowrap text-amber-400"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        >
          {stars}
        </span>
      </span>
      {showValue && <span className="text-xs font-medium text-slate-500">{rating.toFixed(1)}</span>}
    </div>
  );
}
