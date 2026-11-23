import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import SearchBar from './SearchBar';

const link = ({ isActive }: { isActive: boolean }) => `rounded px-2 py-1 text-sm transition hover:text-white ${isActive ? 'text-white' : 'text-slate-400'}`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cartCount, wishlist, points } = useShop();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const onLogout = () => {
    logout();
    setMenu(false);
    setOpen(false);
    toast.info('You have been logged out');
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink-600/70 bg-ink-950/90 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-brand-600 focus:px-3 focus:py-1.5 focus:text-white">Skip to content</a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <button className="rounded p-1.5 text-slate-300 hover:bg-ink-700 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
        </button>
        <Link to="/" className="flex items-center gap-2 text-white">
          <svg className="h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" /><path d="M9 9h6M9 13h6" strokeLinecap="round" /></svg>
          <span className="text-base font-semibold tracking-tight">Book Worm</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 border-l border-ink-600 pl-4 md:flex" aria-label="Main">
          <NavLink to="/books" className={link}>Books</NavLink>
          <NavLink to="/orders" className={link}>My Orders</NavLink>
          <NavLink to="/wishlist" className={link}>My Wishlist{wishlist.length > 0 && <span className="ml-1 text-xs text-slate-500">({wishlist.length})</span>}</NavLink>
          <NavLink to="/addresses" className={link}>Addresses</NavLink>
        </nav>
        <div className="mx-2 hidden max-w-sm flex-1 lg:block"><SearchBar /></div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {user && <span className="hidden rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 sm:inline" title="Reward points">★ {points} pts</span>}
          <Link to="/cart" className="relative rounded-full p-2 text-slate-300 hover:bg-ink-700 hover:text-white" aria-label={`Cart with ${cartCount} items`}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.4 12.2a2 2 0 002 1.6h8.2a2 2 0 002-1.5L21 8H6" /></svg>
            {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{cartCount}</span>}
          </Link>
          {user ? (
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-full p-1.5 text-slate-300 hover:bg-ink-700 hover:text-white" aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 mt-2 w-52 animate-fade-in rounded-lg border border-ink-600 bg-ink-800 p-1 shadow-xl">
                  <p className="truncate px-3 py-2 text-xs text-slate-400">Signed in as<br /><span className="text-sm text-white">{user.name}</span></p>
                  <Link role="menuitem" onClick={() => setMenu(false)} to="/orders" className="block rounded px-3 py-2 text-sm text-slate-200 hover:bg-ink-700">My Orders</Link>
                  <Link role="menuitem" onClick={() => setMenu(false)} to="/addresses" className="block rounded px-3 py-2 text-sm text-slate-200 hover:bg-ink-700">Addresses</Link>
                  <button role="menuitem" onClick={onLogout} className="block w-full rounded px-3 py-2 text-left text-sm text-rose-300 hover:bg-ink-700">Logout</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="rounded-md px-3 py-1.5 text-sm text-slate-200 hover:bg-ink-700">Login</Link>
              <Link to="/register" className="hidden rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 sm:block">Register</Link>
            </>
          )}
        </div>
      </div>
      {open && (
        <div className="animate-fade-in border-t border-ink-600 bg-ink-900 px-4 pb-4 pt-3 md:hidden">
          <SearchBar className="mb-3" />
          <nav className="flex flex-col" aria-label="Mobile">
            {[['/', 'Home'], ['/books', 'Books'], ['/orders', 'My Orders'], ['/wishlist', 'My Wishlist'], ['/addresses', 'Addresses'], ['/cart', 'Cart']].map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `rounded px-2 py-2.5 text-sm ${isActive ? 'bg-ink-700 text-white' : 'text-slate-300'}`}>{label}</NavLink>
            ))}
            {user ? <button onClick={onLogout} className="rounded px-2 py-2.5 text-left text-sm text-rose-300">Logout</button> : <Link to="/register" onClick={() => setOpen(false)} className="rounded px-2 py-2.5 text-sm text-brand-400">Create an account</Link>}
          </nav>
        </div>
      )}
    </header>
  );
}
