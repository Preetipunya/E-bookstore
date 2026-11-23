import { Link } from 'react-router-dom';
import BookRail from '../components/BookRail';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { BOOKS, CATEGORIES, PUBLISHERS, recommendationsForMany } from '../data/catalog';
import { useFakeLoading } from '../hooks/useFakeLoading';
import { Shimmer } from '../components/BookCard';

function RailSkeleton() {
  return (
    <div className="mt-10" aria-hidden>
      <div className="relative mb-4 h-6 w-48 overflow-hidden rounded bg-ink-700"><Shimmer /></div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-md bg-ink-700 sm:w-44"><Shimmer /></div>)}
      </div>
    </div>
  );
}

export default function Home() {
  const loading = useFakeLoading([], 500);
  const { user } = useAuth();
  const { orders } = useShop();

  const featured = BOOKS.filter((b) => b.featured);
  const best = BOOKS.filter((b) => b.bestseller).sort((a, b) => b.rating - a.rating);
  const topRated = [...BOOKS].sort((a, b) => b.rating - a.rating).slice(0, 10);
  const purchased = Array.from(new Set(orders.filter((o) => o.status !== 'Cancelled').flatMap((o) => o.items.map((i) => i.bookId))));
  const recommended = recommendationsForMany(purchased, 10);

  return (
    <div className="animate-fade-in">
      <section className="relative overflow-hidden rounded-2xl border border-ink-600 bg-gradient-to-br from-brand-700 via-ink-800 to-ink-900 px-6 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Welcome to Book Worm</p>
          <h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-white sm:text-5xl">Find your next great read.</h1>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">Thousands of stories, ideas and guides - delivered to your door. Free shipping above ₹499 and reward points on every order.</p>
          <SearchBar className="mt-6 max-w-xl bg-ink-900/70" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/books" className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-200">Browse all books</Link>
            {!user && <Link to="/register" className="rounded-md border border-white/30 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10">Join &amp; get 50 points</Link>}
          </div>
        </div>
      </section>

      <section className="mt-10" aria-label="Categories">
        <h2 className="mb-4 text-xl font-semibold text-white">Shop by category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {CATEGORIES.map((c) => (
            <Link key={c.name} to={`/books?category=${encodeURIComponent(c.name)}`} className="group rounded-xl border border-ink-600 bg-ink-800 p-4 transition hover:-translate-y-0.5 hover:border-brand-500">
              <svg className="h-7 w-7 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={c.icon} /></svg>
              <p className="mt-3 text-sm font-semibold text-white group-hover:text-brand-400">{c.name}</p>
              <p className="text-xs text-slate-400">{c.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {loading ? (
        <><RailSkeleton /><RailSkeleton /></>
      ) : (
        <>
          <BookRail title="Featured books" books={featured} action={{ label: 'See all', to: '/books' }} />
          <BookRail title="Best sellers" books={best} action={{ label: 'See all', to: '/books?sort=rating' }} />
          <section className="mt-10 grid gap-4 md:grid-cols-2" aria-label="Promotions">
            <div className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-ink-950">
              <p className="text-xs font-bold uppercase tracking-widest">Reward points</p>
              <p className="mt-1 text-2xl font-bold">Earn 10 points on every order</p>
              <p className="mt-1 text-sm">Redeem them at checkout for instant savings.</p>
            </div>
            <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-widest">Free delivery</p>
              <p className="mt-1 text-2xl font-bold">Free shipping above ₹499</p>
              <p className="mt-1 text-sm">Changed your mind? Cancel any order within 48 hours.</p>
            </div>
          </section>
          <BookRail title={purchased.length ? 'Recommended for you' : 'Top rated'} books={purchased.length ? recommended : topRated} />
        </>
      )}

      <section className="mt-10" aria-label="Publishers">
        <h2 className="mb-4 text-xl font-semibold text-white">Popular publishers</h2>
        <div className="flex flex-wrap gap-2">
          {PUBLISHERS.map((p) => (
            <Link key={p} to={`/books?publisher=${encodeURIComponent(p)}`} className="rounded-full border border-ink-600 bg-ink-800 px-4 py-1.5 text-sm text-slate-300 hover:border-brand-500 hover:text-white">{p}</Link>
          ))}
        </div>
      </section>
    </div>
  );
}
