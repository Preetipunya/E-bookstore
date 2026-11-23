import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export default function EmptyState({ title, text, actionLabel = 'Browse books', actionTo = '/books', icon }: { title: string; text: string; actionLabel?: string; actionTo?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-500 bg-ink-800/50 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink-700 text-slate-400">
        {icon ?? <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" /></svg>}
      </div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{text}</p>
      <Link to={actionTo} className="mt-5 rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-500">{actionLabel}</Link>
    </div>
  );
}
