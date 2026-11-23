import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AddressForm, { AddressText } from '../components/AddressForm';
import { BookCover } from '../components/BookCard';
import Breadcrumbs from '../components/Breadcrumbs';
import { priceItems, useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { getBook } from '../data/catalog';
import type { CartItem, PaymentMethod } from '../types';
import { deliveryDate, formatPrice } from '../utils/format';

const STEPS = ['Address', 'Summary', 'Reward points', 'Payment'];
const METHODS: PaymentMethod[] = ['Credit Card', 'Debit Card', 'UPI', 'Wallet'];
const WALLETS = ['Paytm', 'PhonePe', 'Amazon Pay', 'Mobikwik'];

type Errors = Record<string, string>;

function validatePayment(method: PaymentMethod, f: { card: string; name: string; expiry: string; cvv: string; upi: string; wallet: string }): Errors {
  const e: Errors = {};
  if (method === 'Credit Card' || method === 'Debit Card') {
    if (f.card.replace(/\s/g, '').length !== 16 || !/^\d+$/.test(f.card.replace(/\s/g, ''))) e.card = 'Enter a 16-digit card number';
    if (f.name.trim().length < 2) e.name = 'Enter the name on the card';
    const m = /^(\d{2})\/(\d{2})$/.exec(f.expiry);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) e.expiry = 'Use MM/YY';
    else {
      const end = new Date(2000 + Number(m[2]), Number(m[1]), 1);
      if (end <= new Date()) e.expiry = 'This card has expired';
    }
    if (!/^\d{3,4}$/.test(f.cvv)) e.cvv = 'Enter the 3-digit CVV';
  } else if (method === 'UPI') {
    if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(f.upi.trim())) e.upi = 'Enter a valid UPI ID, e.g. name@bank';
  } else if (!f.wallet) e.wallet = 'Choose a wallet';
  return e;
}

export default function Checkout() {
  const { cart, addresses, saveAddress, points, placeOrder } = useShop();
  const toast = useToast();
  const navigate = useNavigate();
  const buyNowBookId = (useLocation().state as { buyNowBookId?: number } | null)?.buyNowBookId;

  const items: CartItem[] = buyNowBookId ? [{ bookId: buyNowBookId, quantity: 1 }] : cart;

  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState<string | undefined>(addresses[0]?.id);
  const [adding, setAdding] = useState(addresses.length === 0);
  const [redeem, setRedeem] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('Credit Card');
  const [f, setF] = useState({ card: '', name: '', expiry: '', cvv: '', upi: '', wallet: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!addressId && addresses.length) setAddressId(addresses[0].id);
  }, [addresses, addressId]);

  if (items.length === 0 && !done) return <Navigate to="/cart" replace />;

  const pricing = priceItems(items, points, redeem);
  const address = addresses.find((a) => a.id === addressId);
  const lines = items.flatMap((i) => {
    const book = getBook(i.bookId);
    return book ? [{ ...i, book }] : [];
  });

  const next = () => {
    if (step === 0 && !address) {
      toast.error('Please select or add a delivery address.');
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const pay = () => {
    const errs = validatePayment(method, f);
    setErrors(errs);
    if (Object.keys(errs).length || !address || paying) return;
    setPaying(true);
    // Payment simulator: always succeeds after 2 seconds.
    timer.current = window.setTimeout(() => {
      const order = placeOrder({ items, address, pointsToRedeem: redeem, paymentMethod: method, fromCart: !buyNowBookId });
      setDone(true);
      toast.success('Payment successful!');
      navigate(`/confirmation/${order.id}`, { replace: true });
    }, 2000);
  };

  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const input = (k: keyof typeof f, label: string, opts: { placeholder?: string; max?: number; fmt?: (v: string) => string; type?: string } = {}) => (
    <div>
      <label htmlFor={`pay-${k}`} className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input id={`pay-${k}`} value={f[k]} maxLength={opts.max} type={opts.type ?? 'text'} inputMode={k === 'card' || k === 'cvv' ? 'numeric' : undefined} placeholder={opts.placeholder} aria-invalid={!!errors[k]}
        onChange={(e) => set(k)(opts.fmt ? opts.fmt(e.target.value) : e.target.value)}
        className={`w-full rounded-md border bg-ink-900 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-brand-500 ${errors[k] ? 'border-rose-500' : 'border-ink-600'}`} />
      {errors[k] && <p className="mt-1 text-xs text-rose-400">{errors[k]}</p>}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="mb-5 text-2xl font-semibold text-white">Checkout{buyNowBookId && <span className="ml-2 text-sm font-normal text-amber-300">(Buy Now)</span>}</h1>

      <ol className="mb-6 flex items-center gap-2 overflow-x-auto text-sm" aria-label="Checkout progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2" aria-current={i === step ? 'step' : undefined}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < step ? 'bg-emerald-600 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-ink-600 text-slate-400'}`}>{i < step ? '✓' : i + 1}</span>
            <span className={`whitespace-nowrap ${i === step ? 'font-semibold text-white' : 'text-slate-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-ink-500 sm:w-10" aria-hidden />}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          {step === 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-white">Step 1 · Select delivery address</h2>
              <div className="space-y-3" role="radiogroup" aria-label="Delivery address">
                {addresses.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${addressId === a.id ? 'border-brand-500 bg-brand-500/10' : 'border-ink-600 hover:border-ink-500'}`}>
                    <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-brand-500" />
                    <AddressText a={a} />
                  </label>
                ))}
              </div>
              {adding ? (
                <div className="mt-4"><AddressForm onCancel={() => setAdding(false)} onSave={(a) => { const s = saveAddress(a); setAddressId(s.id); setAdding(false); toast.success('Address added'); }} /></div>
              ) : (
                <button onClick={() => setAdding(true)} className="mt-4 text-sm text-brand-400 hover:underline">+ Add a new address</button>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-white">Step 2 · Order summary</h2>
              {address && (
                <div className="mb-4 rounded-lg bg-ink-700/60 p-3">
                  <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Deliver to</p>
                  <AddressText a={address} />
                </div>
              )}
              <ul className="divide-y divide-ink-600">
                {lines.map(({ book, quantity }) => (
                  <li key={book.id} className="flex gap-4 py-3">
                    <div className="w-14 shrink-0"><BookCover book={book} /></div>
                    <div className="flex-1">
                      <Link to={`/books/${book.id}`} className="font-medium text-white hover:text-brand-400">{book.title}</Link>
                      <p className="text-sm text-slate-400">by {book.author} · Qty {quantity}</p>
                      <p className="text-xs text-slate-500">Delivery by {deliveryDate()}</p>
                    </div>
                    <p className="font-semibold text-white">{formatPrice(book.price * quantity)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-white">Step 3 · Redeem reward points</h2>
              <p className="text-sm text-slate-400">You have <span className="font-semibold text-amber-300">{points} points</span>. 1 point = ₹1 off, up to 50% of the order.</p>
              {pricing.maxRedeemable === 0 ? (
                <p className="mt-5 rounded-md bg-ink-700 px-4 py-3 text-sm text-slate-300">You don't have any points to redeem on this order. You'll earn 10 points when you complete it!</p>
              ) : (
                <div className="mt-5">
                  <label htmlFor="redeem" className="mb-2 block text-sm text-slate-300">Points to redeem: <span className="font-bold text-white">{pricing.pointsDiscount}</span> (max {pricing.maxRedeemable})</label>
                  <input id="redeem" type="range" min={0} max={pricing.maxRedeemable} value={pricing.pointsDiscount} onChange={(e) => setRedeem(Number(e.target.value))} className="w-full accent-amber-400" />
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setRedeem(0)} className="rounded-md border border-ink-500 px-3 py-1.5 text-sm text-slate-200 hover:bg-ink-700">Don't redeem</button>
                    <button onClick={() => setRedeem(pricing.maxRedeemable)} className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-amber-400">Use maximum</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-white">Step 4 · Payment</h2>
              <p className="mb-4 text-sm text-slate-400">Payable amount: <span className="font-bold text-white">{formatPrice(pricing.total)}</span> · This is a simulator - no real payment is made.</p>
              <div className="grid gap-4 sm:grid-cols-[170px_1fr]">
                <div role="tablist" aria-label="Payment method" className="flex gap-1 overflow-x-auto sm:flex-col">
                  {METHODS.map((m) => (
                    <button key={m} role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setErrors({}); }} disabled={paying}
                      className={`whitespace-nowrap rounded-md px-4 py-2.5 text-left text-sm transition ${method === m ? 'border-l-2 border-brand-500 bg-ink-600 font-semibold text-white' : 'bg-ink-700/50 text-slate-400 hover:bg-ink-700'}`}>{m}</button>
                  ))}
                </div>
                <div className="space-y-4" role="tabpanel">
                  {(method === 'Credit Card' || method === 'Debit Card') && (
                    <>
                      {input('card', 'Card number', { placeholder: 'XXXX XXXX XXXX XXXX', max: 19, fmt: (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim() })}
                      <div className="grid grid-cols-2 gap-4">
                        {input('name', 'Name on card', { placeholder: 'Name' })}
                        {input('expiry', 'Expiry (MM/YY)', { placeholder: 'MM/YY', max: 5, fmt: (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; } })}
                      </div>
                      <div className="max-w-[140px]">{input('cvv', 'CVV', { placeholder: 'XXX', max: 4, type: 'password', fmt: (v) => v.replace(/\D/g, '') })}</div>
                    </>
                  )}
                  {method === 'UPI' && input('upi', 'UPI ID', { placeholder: 'name@bank' })}
                  {method === 'Wallet' && (
                    <fieldset>
                      <legend className="mb-2 text-xs font-medium text-slate-400">Choose a wallet</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {WALLETS.map((w) => (
                          <label key={w} className={`cursor-pointer rounded-md border px-3 py-2.5 text-sm ${f.wallet === w ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-ink-600 text-slate-300'}`}>
                            <input type="radio" name="wallet" className="mr-2 accent-brand-500" checked={f.wallet === w} onChange={() => set('wallet')(w)} />{w}
                          </label>
                        ))}
                      </div>
                      {errors.wallet && <p className="mt-1 text-xs text-rose-400">{errors.wallet}</p>}
                    </fieldset>
                  )}
                  <button onClick={pay} disabled={paying} className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-80 sm:w-auto sm:px-10">
                    {paying ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />Processing payment…</>) : `Pay ${formatPrice(pricing.total)}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-between border-t border-ink-600 pt-4">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || paying} className="rounded-md border border-ink-500 px-4 py-2 text-sm text-slate-200 hover:bg-ink-700 disabled:invisible">← Back</button>
            {step < 3 && <button onClick={next} className="rounded-md bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-500">Continue →</button>}
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-ink-600 bg-ink-800 p-5 lg:sticky lg:top-20" aria-label="Price details">
          <h2 className="text-lg font-semibold text-white">Grand total</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Price ({items.reduce((s, i) => s + i.quantity, 0)} items)</dt><dd className="text-white">{formatPrice(pricing.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Delivery charges</dt><dd className="text-white">{pricing.shipping === 0 ? 'Free' : formatPrice(pricing.shipping)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Reward points discount</dt><dd className="text-emerald-400">−{formatPrice(pricing.pointsDiscount)}</dd></div>
            <div className="flex justify-between border-t border-ink-600 pt-3 text-base font-bold"><dt className="text-white">Total amount</dt><dd className="text-white">{formatPrice(pricing.total)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">You'll earn <span className="text-amber-300">10 reward points</span> on this order.</p>
        </aside>
      </div>
    </div>
  );
}
