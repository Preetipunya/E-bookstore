import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { getBook } from '../data/catalog';
import type { Book } from '../types';
import { coverFor } from '../utils/cover';
import { deliveryDate, formatPrice } from '../utils/format';
import { Link } from 'react-router-dom';
import Stars from './Stars';

export function BookCover({ book, className = '' }: { book: Pick<Book, 'image' | 'title' | 'author' | 'id'>; className?: string }) {
  return <img src={coverFor(book.image, book.title, book.author, book.id)} alt={`Cover of ${book.title} by ${book.author}`} loading="lazy" className={`aspect-[2/3] w-full rounded-md object-cover shadow-lg ${className}`} />;
}

export default function BookCard({ book }: { book: Book }) {
  const { addToCart, wishlist, toggleWishlist } = useShop();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const wished = wishlist.includes(book.id);

  const onWish = () => {
    if (!user) {
      toast.info('Please log in to use your wishlist.');
      navigate('/login', { state: { from: '/wishlist' } });
      return;
    }
    toast.success(toggleWishlist(book.id) ? 'Added to wishlist' : 'Removed from wishlist');
  };

  return (
    <article className="group flex gap-4 rounded-xl border border-ink-600/60 bg-ink-800 p-3 transition hover:border-brand-500/60 hover:bg-ink-700/60 sm:p-4">
      <Link to={`/books/${book.id}`} className="block w-24 shrink-0 sm:w-32" aria-label={`View ${book.title}`}>
        <BookCover book={book} className="transition group-hover:scale-[1.03]" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-base font-semibold text-white">
            <Link to={`/books/${book.id}`} className="hover:text-brand-400">{book.title}</Link>
          </h3>
          <button onClick={onWish} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} className={`shrink-0 rounded-full p-1.5 transition hover:bg-ink-600 ${wished ? 'text-rose-400' : 'text-slate-400'}`}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z" /></svg>
          </button>
        </div>
        <p className="mt-0.5 text-sm text-slate-400">by <span className="text-brand-400">{book.author}</span></p>
        <p className="mt-1 hidden text-xs text-slate-400 sm:line-clamp-2">{book.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <Stars rating={book.rating} />
          <span className="rounded bg-ink-600 px-1.5 py-0.5 text-slate-300">{book.category}</span>
        </div>
        <div className="mt-auto pt-3">
          <p className="text-xl font-bold text-white">{formatPrice(book.price)}</p>
          <p className="text-xs text-slate-400">Delivery by <span className="font-semibold text-slate-200">{deliveryDate()}</span></p>
          <button
            onClick={() => { addToCart(book.id); toast.success(`"${book.title}" added to cart`); }}
            className="mt-2 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:w-auto"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}

export function BookCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-xl border border-ink-600/60 bg-ink-800 p-4" aria-hidden>
      <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-md bg-ink-600 sm:w-32"><Shimmer /></div>
      <div className="flex-1 space-y-3">
        {[70, 40, 90, 60].map((w, i) => (
          <div key={i} className="relative h-3 overflow-hidden rounded bg-ink-600" style={{ width: `${w}%` }}><Shimmer /></div>
        ))}
        <div className="relative h-8 w-28 overflow-hidden rounded bg-ink-600"><Shimmer /></div>
      </div>
    </div>
  );
}

export function Shimmer() {
  return <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />;
}

/** Looks a book up by id and renders a compact horizontal card (used by cart / orders). */
export function MiniBook({ bookId }: { bookId: number }) {
  const b = getBook(bookId);
  if (!b) return null;
  return <Link to={`/books/${b.id}`} className="text-white hover:text-brand-400">{b.title}</Link>;
}
