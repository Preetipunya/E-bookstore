import { Link } from 'react-router-dom';
import { CATEGORIES } from '../data/catalog';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-600/70 bg-ink-900">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-semibold text-white">Book Worm</p>
          <p className="mt-2 text-sm text-slate-400">Your neighbourhood bookstore, online. Discover your next favourite read.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Shop</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {CATEGORIES.slice(0, 5).map((c) => (
              <li key={c.name}><Link className="hover:text-white" to={`/books?category=${encodeURIComponent(c.name)}`}>{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Account</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li><Link className="hover:text-white" to="/orders">My Orders</Link></li>
            <li><Link className="hover:text-white" to="/wishlist">My Wishlist</Link></li>
            <li><Link className="hover:text-white" to="/addresses">Addresses</Link></li>
            <li><Link className="hover:text-white" to="/cart">Cart</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Good to know</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>Free shipping above ₹499</li>
            <li>Cancel within 48 hours</li>
            <li>Earn 10 reward points per order</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-600/70 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} Book Worm. Demo project - no real payments or deliveries.</div>
    </footer>
  );
}
