import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchBar({ initial = '', className = '', placeholder = 'Search by title, author or publisher' }: { initial?: string; className?: string; placeholder?: string }) {
  const [q, setQ] = useState(initial);
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/books?q=${encodeURIComponent(q.trim())}` : '/books');
  };
  return (
    <form onSubmit={submit} role="search" className={`flex w-full items-center rounded-lg border border-ink-600 bg-ink-800 focus-within:border-brand-500 ${className}`}>
      <label htmlFor="site-search" className="sr-only">Search books</label>
      <input id="site-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="w-full bg-transparent px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none" />
      <button type="submit" aria-label="Search" className="px-3 text-slate-400 hover:text-white">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      </button>
    </form>
  );
}
