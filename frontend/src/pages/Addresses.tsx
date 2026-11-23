import { useState } from 'react';
import AddressForm, { AddressText } from '../components/AddressForm';
import Breadcrumbs from '../components/Breadcrumbs';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import type { Address } from '../types';

export default function Addresses() {
  const { addresses, saveAddress, deleteAddress } = useShop();
  const toast = useToast();
  const [editing, setEditing] = useState<Address | 'new' | null>(null);

  return (
    <div className="animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'My Addresses' }]} />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">My Addresses</h1>
        {!editing && <button onClick={() => setEditing('new')} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">+ Add address</button>}
      </div>

      {editing && (
        <div className="mb-6">
          <AddressForm
            initial={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSave={(a) => { saveAddress(a); toast.success(a.id ? 'Address updated' : 'Address added'); setEditing(null); }}
          />
        </div>
      )}

      {addresses.length === 0 && !editing ? (
        <p className="rounded-xl border border-dashed border-ink-500 p-10 text-center text-slate-400">No saved addresses yet. Add one to speed up checkout.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-xl border border-ink-600 bg-ink-800 p-4">
              <AddressText a={a} />
              <div className="mt-4 flex gap-3 text-sm">
                <button onClick={() => setEditing(a)} className="text-brand-400 hover:underline">Edit</button>
                <button onClick={() => { if (window.confirm('Delete this address?')) { deleteAddress(a.id); toast.info('Address deleted'); } }} className="text-rose-300 hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
