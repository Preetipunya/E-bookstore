import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../types';
import { KEYS, readJSON, writeJSON } from '../utils/storage';
import { uid } from '../utils/format';

export const WELCOME_POINTS = 50;

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthApi {
  user: User | null;
  login: (email: string, password: string) => AuthResult;
  register: (name: string, email: string, password: string) => AuthResult;
  logout: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

const normalise = (e: string) => e.trim().toLowerCase();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const id = readJSON<string | null>(KEYS.session, null);
    return id ? readJSON<User[]>(KEYS.users, []).find((u) => u.id === id) ?? null : null;
  });

  const login = useCallback((email: string, password: string): AuthResult => {
    const found = readJSON<User[]>(KEYS.users, []).find((u) => normalise(u.email) === normalise(email));
    if (!found) return { ok: false, error: 'No account found with this email.' };
    if (found.password !== password) return { ok: false, error: 'Incorrect password.' };
    writeJSON(KEYS.session, found.id);
    setUser(found);
    return { ok: true };
  }, []);

  const register = useCallback((name: string, email: string, password: string): AuthResult => {
    const users = readJSON<User[]>(KEYS.users, []);
    if (users.some((u) => normalise(u.email) === normalise(email))) return { ok: false, error: 'An account with this email already exists.' };
    const created: User = { id: uid('u_'), name: name.trim(), email: email.trim(), password };
    writeJSON(KEYS.users, [...users, created]);
    writeJSON(KEYS.points(created.id), WELCOME_POINTS);
    writeJSON(KEYS.session, created.id);
    setUser(created);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEYS.session);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
