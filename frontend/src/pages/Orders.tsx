import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddressText } from '../components/AddressForm';
import { BookCover } from '../components/BookCard';
import BookRail from '../components/BookRail';
import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { recommendationsForMany } from '../data/catalog';
import type { Order } from '../types';
import { cancellationState, formatDateTime, formatPrice } from '../utils/format';

function OrderCard({ order }: { order: Order }) {
  const { cancelOrder, buyAgain } = useShop();
  const toast = useToast();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(t);
  }, []);

  const cancel = cancellationState(order.createdAt, now);
  const cancelled = order.status === 'Cancelled';

  const onBuyAgain = () => {
    const n = buyAgain(order.id);
    toast.success(`${n} item${n === 1 ? '' : 's'} added to your cart`);
    navigate('/cart');
  };
  const onCancel = () => {
    const res = cancelOrder(order.id);
    if (res.ok) toast.success('Order cancelled. Reward points have been adjusted.');
    else toast.error(res.error ?? 'Could not cancel');
    setConfirming(false);
  };

  return (
    <li className="overflow-hidden rounded-xl border border-ink-600 bg-ink-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-600 bg-ink-700/40 px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-x-8 gap-y-1">
          <div><p className="text-xs text-slate-500">Order ID</p><p className="font-mono text-white">{order.id}</p></div>
          <div><p className="text-xs text-slate-500">Purchase date</p><p className="text-white">{formatDateTime(order.createdAt)}</p></div>
          <div><p className="text-xs text-slate-500">Total amount</p><p className="font-semibold text-white">{formatPrice(order.total)}</p></div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cancelled ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{order.status}</span>
      </div>

      <ul className="divide-y divide-ink-600/60 px-4">
        {order.items.map((i) => (
          <li key={i.bookId} className="flex gap-4 py-3">
            <div className="w-14 shrink-0"><BookCover book={{ id: i.bookId, image: i.image, title: i.title, author: i.author }} /></div>
            <div className="min-w-0 flex-1">
              <Link to={`/books/${i.bookId}`} className="line-clamp-2 font-medium text-white hover:text-brand-400">{i.title}</Link>
              <p className="text-sm text-slate-400">by {i.author} · Qty {i.quantity}</p>
            </div>
            <p className="text-sm font-semibold text-white">{formatPrice(i.price * i.quantity)}</p>
          </li>
        ))}
      </ul>

      {open && (
        <div className="grid gap-4 border-t border-ink-600 px-4 py-4 text-sm sm:grid-cols-2">
          <div><p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Delivery address</p><AddressText a={order.address} /></div>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt className="text-slate-400">Subtotal</dt><dd className="text-white">{formatPrice(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Shipping</dt><dd className="text-white">{order.shipping ? formatPrice(order.shipping) : 'Free'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Points redeemed</dt><dd className="text-white">−{formatPrice(order.pointsRedeemed)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Payment</dt><dd className="text-white">{order.paymentMethod}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Transaction</dt><dd className="font-mono text-white">{order.transactionId}</dd></div>
            {order.cancelledAt && <div className="flex justify-between"><dt className="text-slate-400">Cancelled on</dt><dd className="text-rose-300">{formatDateTime(order.cancelledAt)}</dd></div>}
          </dl>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-600 px-4 py-3">
        <button onClick={onBuyAgain} className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500">Buy Again</button>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-md border border-ink-500 px-4 py-1.5 text-sm text-slate-200 hover:bg-ink-700">{open ? 'Hide details' : 'View details'}</button>
        {!cancelled && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            {cancel.allowed ? (
              confirming ? (
                <>
                  <span className="text-slate-300">Cancel this order?</span>
                  <button onClick={onCancel} className="rounded-md bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-500">Yes, cancel</button>
                  <button onClick={() => setConfirming(false)} className="text-slate-300 hover:underline">Keep</button>
                </>
              ) : (
                <>
                  <span className="hidden text-xs text-slate-500 sm:inline">Cancel within {cancel.hoursLeft}h</span>
                  <button onClick={() => setConfirming(true)} className="rounded-md border border-rose-500/60 px-4 py-1.5 text-rose-300 hover:bg-rose-500/10">Cancel order</button>
                </>
              )
            ) : (
              <span className="text-xs text-slate-500" title="Orders can only be cancelled within 48 hours of purchase">Cancellation window (48h) has ended</span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function Orders() {
  const { orders, points } = useShop();
  const bought = Array.from(new Set(orders.filter((o) => o.status !== 'Cancelled').flatMap((o) => o.items.map((i) => i.bookId))));

  return (
    <div className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'My Orders' }]} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">My Orders</h1>
        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-300">★ {points} reward points</span>
      </div>
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" text="When you place an order it will show up here, with a Buy Again shortcut." actionLabel="Start shopping" />
      ) : (
        <ul className="space-y-5">{orders.map((o) => <OrderCard key={o.id} order={o} />)}</ul>
      )}
      <BookRail title="Recommended based on your orders" books={recommendationsForMany(bought, 8)} />
    </div>
  );
}
