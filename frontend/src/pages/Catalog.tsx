import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BookCard, { BookCardSkeleton } from '../components/BookCard';
import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import { BOOKS, CATEGORIES, PUBLISHERS } from '../data/catalog';
import { useDebounce } from '../hooks/useDebounce';
import { useFakeLoading } from '../hooks/useFakeLoading';
import { formatPrice } from '../utils/format';

const PRICE_RANGES = [
  { id: 'all', label: 'All prices', min: 0, max: Infinity },
  { id: 'u300', label: 'Under ₹300', min: 0, max: 299 },
  { id: '300-500', label: '₹300 - ₹500', min: 300, max: 500 },
  { id: '500-700', label: '₹500 - ₹700', min: 500, max: 700 },
  { id: 'o700', label: 'Above ₹700', min: 700, max: Infinity },
];

const SORTS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'rating', label: 'Rating: High to Low' },
];

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? 'All';
  const publisher = params.get('publisher') ?? 'All';
  const price = params.get('price') ?? 'all';
  const sort = params.get('sort') ?? 'relevance';
  const urlQuery = params.get('q') ?? '';

  const [text, setText] = useState(urlQuery);
  // keep the box in sync when the URL query changes (e.g. searching from the navbar)
  useEffect(() => setText(urlQuery), [urlQuery]);
  const q = useDebounce(text, 200).trim().toLowerCase();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const update = (k: string, v: string, def: string) => {
    const next = new URLSearchParams(params);
    if (v === def || !v) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const results = useMemo(() => {
    const range = PRICE_RANGES.find((r) => r.id === price) ?? PRICE_RANGES[0];
    const term = q;
    const list = BOOKS.filter(
      (b) =>
        (category === 'All' || b.category === category) &&
        (publisher === 'All' || b.publisher === publisher) &&
        b.price >= range.min && b.price <= range.max &&
        (!term || `${b.title} ${b.author} ${b.publisher} ${b.category}`.toLowerCase().includes(term)),
    );
    if (sort === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') list.sort((a, b) => b.price - a.price);
    else if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [category, publisher, price, sort, q]);

  const loading = useFakeLoading([category, publisher, price, sort, q], 350);
  const activeFilters = (category !== 'All' ? 1 : 0) + (publisher !== 'All' ? 1 : 0) + (price !== 'all' ? 1 : 0);

  const clearAll = () => {
    setText('');
    setParams(new URLSearchParams(), { replace: true });
  };

  const radio = (name: string, current: string, value: string, label: string, onChange: () => void, count?: number) => (
    <label key={value} className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-sm transition ${current === value ? 'bg-ink-600 text-white' : 'text-slate-400 hover:bg-ink-700 hover:text-white'}`}>
      <span className="flex items-center gap-2">
        <input type="radio" name={name} checked={current === value} onChange={onChange} className="accent-brand-500" />
        {label}
      </span>
      {count !== undefined && <span className="text-xs text-slate-500">{count}</span>}
    </label>
  );

  const sidebar = (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</legend>
        {radio('category', category, 'All', 'All', () => update('category', 'All', 'All'), BOOKS.length)}
        {CATEGORIES.map((c) => radio('category', category, c.name, c.name, () => update('category', c.name, 'All'), BOOKS.filter((b) => b.category === c.name).length))}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Price</legend>
        {PRICE_RANGES.map((r) => radio('price', price, r.id, r.label, () => update('price', r.id, 'all')))}
      </fieldset>
      <div>
        <label htmlFor="publisher" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Publisher</label>
        <select id="publisher" value={publisher} onChange={(e) => update('publisher', e.target.value, 'All')} className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-white">
          <option value="All">All publishers</option>
          {PUBLISHERS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      {(activeFilters > 0 || text) && <button onClick={clearAll} className="text-sm text-brand-400 hover:underline">Clear all filters</button>}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Books', to: category !== 'All' ? '/books' : undefined }, ...(category !== 'All' ? [{ label: category }] : [])]} />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-20 rounded-xl border border-ink-600 bg-ink-800 p-4">{sidebar}</div>
        </aside>

        <section>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
            <div className="flex items-center rounded-lg border border-ink-600 bg-ink-800 focus-within:border-brand-500">
              <label htmlFor="catalog-search" className="sr-only">Search books</label>
              <input id="catalog-search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by title, author, publisher" className="w-full bg-transparent px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none" />
              {text && <button onClick={() => { setText(''); update('q', '', ''); }} aria-label="Clear search" className="px-3 text-slate-400 hover:text-white">✕</button>}
            </div>
            <div>
              <label htmlFor="sort" className="sr-only">Sort by</label>
              <select id="sort" value={sort} onChange={(e) => update('sort', e.target.value, 'relevance')} className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-white">
                {SORTS.map((s) => <option key={s.id} value={s.id}>Sort by: {s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-400" aria-live="polite">{loading ? 'Loading…' : `${results.length} book${results.length === 1 ? '' : 's'} found`}{price !== 'all' && !loading ? ` · ${PRICE_RANGES.find((r) => r.id === price)?.label}` : ''}</p>
            <button onClick={() => setFiltersOpen(true)} className="flex items-center gap-1.5 rounded-md border border-ink-600 px-3 py-1.5 text-sm text-slate-200 lg:hidden">
              Filters{activeFilters > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs">{activeFilters}</span>}
            </button>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <BookCardSkeleton key={i} />)}</div>
          ) : results.length === 0 ? (
            <EmptyState title="No books match your filters" text="Try a different search term or clear some filters." actionLabel="Clear filters" actionTo="/books" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{results.map((b) => <BookCard key={b.id} book={b} />)}</div>
          )}
          {!loading && results.length > 0 && <p className="mt-6 text-center text-xs text-slate-500">Prices from {formatPrice(Math.min(...results.map((b) => b.price)))} to {formatPrice(Math.max(...results.map((b) => b.price)))}</p>}
        </section>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] animate-fade-in overflow-y-auto border-r border-ink-600 bg-ink-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="text-slate-400 hover:text-white">✕</button>
            </div>
            {sidebar}
            <button onClick={() => setFiltersOpen(false)} className="mt-6 w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white">Show {results.length} books</button>
          </div>
        </div>
      )}
    </div>
  );
}
