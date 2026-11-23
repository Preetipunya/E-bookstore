export default function Stars({ rating, showValue = true }: { rating: number; showValue?: boolean }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rated ${rating} out of 5`}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <svg key={n} className={`h-3.5 w-3.5 ${n <= full ? 'text-amber-400' : 'text-ink-500'}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 15l-5.2 2.7 1-5.9L1.5 7.7l5.9-.8L10 1.5z" />
          </svg>
        ))}
      </span>
      {showValue && <span className="text-slate-300">{rating.toFixed(1)}</span>}
    </span>
  );
}
