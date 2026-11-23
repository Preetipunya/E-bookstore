import { Link } from 'react-router-dom';
import { BookCover } from '../components/BookCard';
import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import Stars from '../components/Stars';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { getBook } from '../data/catalog';
import { formatPrice } from '../utils/format';

export default function Wishlist() {
  const { wishlist, removeFromWishlist, moveToCart } = useShop();
  const toast = useToast();
  const books = wishlist.flatMap((id) => {
    const b = getBook(id);
    return b ? [b] : [];
  });

  return (
    <div className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'My Wishlist' }]} />
      <h1 className="mb-5 text-2xl font-semibold text-white">My Wishlist</h1>
      {books.length === 0 ? (
        <EmptyState title="Your wishlist is empty" text="Tap the heart on any book to save it for later." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {books.map((b) => (
            <li key={b.id} className="flex gap-4 rounded-xl border border-ink-600 bg-ink-800 p-4">
              <Link to={`/books/${b.id}`} className="w-24 shrink-0"><BookCover book={b} /></Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={`/books/${b.id}`} className="line-clamp-2 font-semibold text-white hover:text-brand-400">{b.title}</Link>
                <p className="text-sm text-slate-400">by {b.author}</p>
                <div className="mt-1 text-xs"><Stars rating={b.rating} /></div>
                <p className="mt-2 text-lg font-bold text-white">{formatPrice(b.price)}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <button onClick={() => { moveToCart(b.id); toast.success('Moved to cart'); }} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500">Move to Cart</button>
                  <button onClick={() => { removeFromWishlist(b.id); toast.info('Removed from wishlist'); }} className="rounded-md border border-ink-500 px-3 py-1.5 text-sm text-slate-200 hover:bg-ink-700">Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
