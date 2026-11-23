import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Props {
  mode: 'login' | 'register';
}

export default function AuthPage({ mode }: Props) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const locState = useLocation().state as { from?: string; buyNowBookId?: number } | null;
  const from = locState?.from ?? '/';
  const buyNowBookId = locState?.buyNowBookId;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isLogin && name.trim().length < 2) errs.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email address';
    if (isLogin ? !password : password.length < 6) errs.password = isLogin ? 'Enter your password' : 'Use at least 6 characters';
    if (!isLogin && confirm !== password) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    const res = isLogin ? login(email, password) : register(name, email, password);
    setBusy(false);
    if (!res.ok) {
      setErrors({ form: res.error ?? 'Something went wrong' });
      return;
    }
    toast.success(isLogin ? 'Welcome back!' : 'Account created - you received 50 welcome points!');
    navigate(from, { replace: true, state: buyNowBookId ? { buyNowBookId } : undefined });
  };

  const input = (id: string, label: string, value: string, set: (v: string) => void, type = 'text', auto?: string) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input id={id} type={type} value={value} autoComplete={auto} onChange={(e) => set(e.target.value)} aria-invalid={!!errors[id]}
        className={`w-full rounded-md border bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500 ${errors[id] ? 'border-rose-500' : 'border-ink-600'}`} />
      {errors[id] && <p className="mt-1 text-xs text-rose-400">{errors[id]}</p>}
    </div>
  );

  return (
    <div className="mx-auto flex max-w-md flex-col py-6 sm:py-12">
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6 shadow-2xl sm:p-8">
        <h1 className="text-2xl font-semibold text-white">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-slate-400">{isLogin ? 'Log in to see your orders, wishlist and reward points.' : 'Sign up to earn reward points on every order.'}</p>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          {errors.form && <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">{errors.form}</p>}
          {!isLogin && input('name', 'Full name', name, setName, 'text', 'name')}
          {input('email', 'Email', email, setEmail, 'email', 'email')}
          {input('password', 'Password', password, setPassword, 'password', isLogin ? 'current-password' : 'new-password')}
          {!isLogin && input('confirm', 'Confirm password', confirm, setConfirm, 'password', 'new-password')}
          <button disabled={busy} className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60">{isLogin ? 'Log in' : 'Register'}</button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-400">
          {isLogin ? "New to Book Worm? " : 'Already have an account? '}
          <Link to={isLogin ? '/register' : '/login'} state={{ from, buyNowBookId }} className="text-brand-400 hover:underline">{isLogin ? 'Create an account' : 'Log in'}</Link>
        </p>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">Demo app: accounts live only in this browser's localStorage.</p>
    </div>
  );
}
