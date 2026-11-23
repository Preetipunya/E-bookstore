import { Link, useNavigate } from 'react-router-dom';
import { BookCover } from '../components/BookCard';
import BookRail from '../components/BookRail';
import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { priceItems, useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { getBook, recommendationsForMany } from '../data/catalog';
import { FREE_SHIPPING_ABOVE, formatPrice } from '../utils/format';

export default function Cart() {
  const { cart, setQuantity, removeFromCart } = useShop();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const lines = cart.flatMap((i) => {
    const book = getBook(i.bookId);
    return book ? [{ ...i, book }] : [];
  });
  const pricing = priceItems(cart, 0, 0);
  const remaining = Math.max(0, FREE_SHIPPING_ABOVE - pricing.subtotal);

  const checkout = () => {
    if (!user) {
      toast.info('Please log in to continue to checkout.');
      navigate('/login', { state: { from: '/checkout' } });
    } else navigate('/checkout');
  };

  return (
    <div className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Shopping Cart' }]} />
      <h1 className="mb-5 text-2xl font-semibold text-white">Shopping Cart</h1>

      {lines.length === 0 ? (
        <EmptyState title="Your cart is empty" text="Looks like you haven't added any books yet." actionLabel="Continue shopping" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <ul className="space-y-4">
            {lines.map(({ book, quantity }) => (
              <li key={book.id} className="flex gap-4 rounded-xl border border-ink-600 bg-ink-800 p-4">
                <Link to={`/books/${book.id}`} className="w-20 shrink-0 sm:w-28"><BookCover book={book} /></Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/books/${book.id}`} className="line-clamp-2 font-semibold text-white hover:text-brand-400">{book.title}</Link>
                  <p className="text-sm text-slate-400">by {book.author}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{book.publisher} · {book.category}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    <div className="inline-flex items-center rounded-md border border-ink-500" role="group" aria-label={`Quantity for ${book.title}`}>
                      <button onClick={() => setQuantity(book.id, quantity - 1)} aria-label="Decrease quantity" className="px-3 py-1.5 text-slate-300 hover:bg-ink-700">−</button>
                      <span className="min-w-[2rem] text-center text-sm text-white" aria-live="polite">{quantity}</span>
                      <button onClick={() => setQuantity(book.id, quantity + 1)} disabled={quantity >= 10} aria-label="Increase quantity" className="px-3 py-1.5 text-slate-300 hover:bg-ink-700 disabled:opacity-40">+</button>
                    </div>
                    <p className="text-lg font-bold text-white">{formatPrice(book.price * quantity)}</p>
                    <button onClick={() => { removeFromCart(book.id); toast.info('Removed from cart'); }} className="text-sm text-rose-300 hover:underline">Remove</button>
                  </div>
                </div>
              </li>
            ))}
            <li><Link to="/books" className="text-sm text-brand-400 hover:underline">← Continue shopping</Link></li>
          </ul>

          <aside className="h-fit rounded-xl border border-ink-600 bg-ink-800 p-5 lg:sticky lg:top-20" aria-label="Order total">
            <h2 className="text-lg font-semibold text-white">Cart total</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</dt><dd className="text-white">{formatPrice(pricing.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Shipping</dt><dd className="text-white">{pricing.shipping === 0 ? 'Free' : formatPrice(pricing.shipping)}</dd></div>
              <div className="flex justify-between border-t border-ink-600 pt-3 text-base font-bold"><dt className="text-white">Total</dt><dd className="text-white">{formatPrice(pricing.subtotal + pricing.shipping)}</dd></div>
            </dl>
            {remaining > 0 && <p className="mt-3 rounded-md bg-ink-700 px-3 py-2 text-xs text-slate-300">Add {formatPrice(remaining)} more for free shipping.</p>}
            <button onClick={checkout} className="mt-5 w-full rounded-md bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500">Proceed to Checkout</button>
          </aside>
        </div>
      )}
      <BookRail title="You might also like" books={recommendationsForMany(cart.map((c) => c.bookId), 8)} />
    </div>
  );
}
