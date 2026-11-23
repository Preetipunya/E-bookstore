import { Link, useNavigate, useParams } from 'react-router-dom';
import BookRail from '../components/BookRail';
import { BookCover } from '../components/BookCard';
import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import Stars from '../components/Stars';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { getBook, recommendationsFor } from '../data/catalog';
import { deliveryDate, formatPrice } from '../utils/format';

export default function BookDetails() {
  const { id } = useParams();
  const book = getBook(Number(id));
  const { addToCart, wishlist, toggleWishlist } = useShop();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  if (!book) return <EmptyState title="Book not found" text="The book you are looking for does not exist or was removed." />;

  const wished = wishlist.includes(book.id);
  const related = recommendationsFor(book, 8);

  const onWish = () => {
    if (!user) {
      toast.info('Please log in to use your wishlist.');
      navigate('/login', { state: { from: `/books/${book.id}` } });
      return;
    }
    toast.success(toggleWishlist(book.id) ? 'Added to wishlist' : 'Removed from wishlist');
  };

  const buyNow = () => {
    // Buy Now checks out only this book, without touching the cart.
    if (!user) {
      toast.info('Please log in to continue to checkout.');
      navigate('/login', { state: { from: '/checkout', buyNowBookId: book.id } });
      return;
    }
    navigate('/checkout', { state: { buyNowBookId: book.id } });
  };

  return (
    <div className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: book.category, to: `/books?category=${encodeURIComponent(book.category)}` }, { label: book.title }]} />
      <div className="grid gap-8 md:grid-cols-[300px_1fr]">
        <div className="mx-auto w-56 md:w-full"><BookCover book={book} /></div>
        <div>
          <h1 className="font-serif text-3xl font-bold text-white sm:text-4xl">{book.title}</h1>
          <p className="mt-2 text-slate-400">by <span className="text-brand-400">{book.author}</span></p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Stars rating={book.rating} />
            <span className="rounded bg-ink-600 px-2 py-0.5 text-slate-300">{book.category}</span>
            {book.bestseller && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">Best seller</span>}
          </div>
          <p className="mt-5 max-w-2xl leading-relaxed text-slate-300">{book.description}</p>
          <dl className="mt-5 grid max-w-md grid-cols-[110px_1fr] gap-y-1.5 text-sm">
            <dt className="text-slate-500">Publisher</dt>
            <dd><Link to={`/books?publisher=${encodeURIComponent(book.publisher)}`} className="text-brand-400 hover:underline">{book.publisher}</Link></dd>
            <dt className="text-slate-500">Category</dt><dd className="text-slate-200">{book.category}</dd>
            <dt className="text-slate-500">Rating</dt><dd className="text-slate-200">{book.rating.toFixed(1)} / 5</dd>
          </dl>
          <p className="mt-6 text-4xl font-bold text-white">{formatPrice(book.price)}</p>
          <p className="mt-1 text-sm text-slate-400">Delivery by <span className="font-semibold text-slate-200">{deliveryDate()}</span> · {book.price >= 499 ? 'Free shipping' : 'Free shipping above ₹499'}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => { addToCart(book.id); toast.success('Added to cart'); }} className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500">Add to Cart</button>
            <button onClick={buyNow} className="rounded-md bg-amber-500 px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-amber-400">Buy Now</button>
            <button onClick={onWish} aria-pressed={wished} className="rounded-md border border-ink-500 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-ink-700">{wished ? '♥ In Wishlist' : '♡ Add to Wishlist'}</button>
          </div>
        </div>
      </div>
      <BookRail title="Related reads" books={related} />
    </div>
  );
}
