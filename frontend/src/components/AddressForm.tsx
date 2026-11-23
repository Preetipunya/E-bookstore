import { useState, type FormEvent } from 'react';
import type { Address } from '../types';

type Draft = Omit<Address, 'id'>;
const EMPTY: Draft = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', country: 'India', postalCode: '' };

function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {};
  if (d.fullName.trim().length < 2) e.fullName = 'Enter the full name';
  if (!/^\+?[0-9 -]{8,15}$/.test(d.phone.trim())) e.phone = 'Enter a valid phone number';
  if (d.line1.trim().length < 3) e.line1 = 'Enter the address';
  if (d.city.trim().length < 2) e.city = 'Enter the city';
  if (d.state.trim().length < 2) e.state = 'Enter the state';
  if (d.country.trim().length < 2) e.country = 'Enter the country';
  if (!/^[A-Za-z0-9 -]{4,10}$/.test(d.postalCode.trim())) e.postalCode = 'Enter a valid postal code';
  return e;
}

interface Props {
  initial?: Address;
  onSave: (a: Draft & { id?: string }) => void;
  onCancel: () => void;
}

export default function AddressForm({ initial, onSave, onCancel }: Props) {
  const [d, setD] = useState<Draft>(initial ? { ...initial } : EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});

  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(d);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({ ...d, id: initial?.id });
  };

  const field = (k: keyof Draft, label: string, opts: { span?: boolean; type?: string; placeholder?: string; optional?: boolean } = {}) => (
    <div className={opts.span ? 'sm:col-span-2' : ''}>
      <label htmlFor={`addr-${k}`} className="mb-1 block text-xs font-medium text-slate-400">{label}{opts.optional && ' (optional)'}</label>
      <input id={`addr-${k}`} type={opts.type ?? 'text'} value={d[k]} onChange={set(k)} placeholder={opts.placeholder} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `addr-${k}-err` : undefined}
        className={`w-full rounded-md border bg-ink-900 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-brand-500 ${errors[k] ? 'border-rose-500' : 'border-ink-600'}`} />
      {errors[k] && <p id={`addr-${k}-err`} className="mt-1 text-xs text-rose-400">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-xl border border-ink-600 bg-ink-800 p-5 sm:grid-cols-2">
      <h3 className="text-base font-semibold text-white sm:col-span-2">{initial ? 'Edit address' : 'Add a new address'}</h3>
      {field('fullName', 'Full name')}
      {field('phone', 'Phone', { type: 'tel', placeholder: '+91 98765 43210' })}
      {field('line1', 'Address line 1', { span: true })}
      {field('line2', 'Address line 2', { span: true, optional: true })}
      {field('city', 'City')}
      {field('state', 'State')}
      {field('country', 'Country')}
      {field('postalCode', 'Postal code', { placeholder: '560001' })}
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-500">Save address</button>
        <button type="button" onClick={onCancel} className="rounded-md border border-ink-500 px-5 py-2 text-sm text-slate-200 hover:bg-ink-700">Cancel</button>
      </div>
    </form>
  );
}

export function AddressText({ a }: { a: Address }) {
  return (
    <address className="text-sm not-italic leading-relaxed text-slate-300">
      <span className="font-semibold text-white">{a.fullName}</span> · {a.phone}<br />
      {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />
      {a.city}, {a.state} {a.postalCode}, {a.country}
    </address>
  );
}
