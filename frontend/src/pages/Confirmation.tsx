import { Link, Navigate, useParams } from 'react-router-dom';
import { AddressText } from '../components/AddressForm';
import { BookCover } from '../components/BookCard';
import { useShop } from '../context/ShopContext';
import { formatDateTime, formatPrice } from '../utils/format';

export default function Confirmation() {
  const { orderId } = useParams();
  const { orders, points } = useShop();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return <Navigate to="/orders" replace />;

  return (
    <div className="mx-auto max-w-3xl animate-fade-in py-4">
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6 text-center shadow-2xl sm:p-10">
        <div className="mx-auto flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-emerald-500">
          <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 13l4 4L19 7" /></svg>
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-white">Your purchase of the following reads is successful</h1>
        <p className="mt-2 text-sm text-slate-400">Thank you! A confirmation has been recorded for order <span className="font-mono text-slate-200">{order.id}</span>.</p>

        <ul className="mt-6 grid gap-3 text-left sm:grid-cols-2">
          {order.items.map((i) => (
            <li key={i.bookId} className="flex gap-3 rounded-lg bg-ink-700/60 p-3">
              <div className="w-14 shrink-0"><BookCover book={{ id: i.bookId, image: i.image, title: i.title, author: i.author }} /></div>
              <div className="min-w-0">
                <Link to={`/books/${i.bookId}`} className="line-clamp-2 text-sm font-medium text-white hover:text-brand-400">{i.title}</Link>
                <p className="text-xs text-slate-400">by {i.author}</p>
                <p className="mt-1 text-sm font-semibold text-white">{formatPrice(i.price)} × {i.quantity}</p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-6 grid gap-3 rounded-lg border border-ink-600 p-4 text-left text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Order ID</dt><dd className="font-mono text-white">{order.id}</dd></div>
          <div><dt className="text-slate-500">Transaction ID</dt><dd className="font-mono text-white">{order.transactionId}</dd></div>
          <div><dt className="text-slate-500">Date</dt><dd className="text-white">{formatDateTime(order.createdAt)}</dd></div>
          <div><dt className="text-slate-500">Payment</dt><dd className="text-white">{order.paymentMethod}</dd></div>
          <div><dt className="text-slate-500">Amount paid</dt><dd className="font-semibold text-white">{formatPrice(order.total)}</dd></div>
          <div><dt className="text-slate-500">Reward points</dt><dd className="text-amber-300">+{order.pointsEarned} earned{order.pointsRedeemed > 0 ? ` · ${order.pointsRedeemed} redeemed` : ''} · balance {points}</dd></div>
          <div className="sm:col-span-2"><dt className="mb-1 text-slate-500">Delivering to</dt><dd><AddressText a={order.address} /></dd></div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">Changed your mind? You can cancel this order within 48 hours from My Orders.</p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/books" className="rounded-md bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500">Continue your Shopping</Link>
          <Link to="/orders" className="rounded-md border border-ink-500 px-6 py-2.5 text-sm text-slate-200 hover:bg-ink-700">View my orders</Link>
        </div>
      </div>
    </div>
  );
}
