import { badRequest } from './errors';

export type PaymentMethod = 'credit_card' | 'debit_card' | 'upi' | 'net_banking' | 'wallet';
export const PAYMENT_METHODS: PaymentMethod[] = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'];
export const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank'];
export const WALLETS = ['Paytm', 'PhonePe', 'Amazon Pay', 'Mobikwik'];

export function luhn(num: string): boolean {
  const digits = num.replace(/\s|-/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function parseExpiry(exp: string): { month: number; year: number } | null {
  const m = /^(\d{2})\s*\/\s*(\d{2}|\d{4})$/.exec(exp.trim());
  if (!m) return null;
  const month = Number(m[1]);
  let year = Number(m[2]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export function isExpired(exp: { month: number; year: number }, now = new Date()): boolean {
  const endOfMonth = new Date(Date.UTC(exp.year, exp.month, 1)); // first instant after expiry month
  return endOfMonth <= now;
}

/** Validates method-specific details. Returns a masked copy that is safe to persist. */
export function validatePaymentDetails(method: PaymentMethod, d: Record<string, any> = {}, now = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  switch (method) {
    case 'credit_card':
    case 'debit_card': {
      const num = String(d.cardNumber ?? '');
      if (!luhn(num)) errors.cardNumber = 'Enter a valid card number';
      if (!String(d.nameOnCard ?? '').trim()) errors.nameOnCard = 'Name on card is required';
      const exp = parseExpiry(String(d.expiry ?? ''));
      if (!exp) errors.expiry = 'Expiry must be MM/YY or MM/YYYY';
      else if (isExpired(exp, now)) errors.expiry = 'Card has expired';
      if (!/^\d{3,4}$/.test(String(d.cvv ?? ''))) errors.cvv = 'CVV must be 3 or 4 digits';
      break;
    }
    case 'upi':
      if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(String(d.upiId ?? ''))) errors.upiId = 'Enter a valid UPI ID (e.g. name@bank)';
      break;
    case 'net_banking':
      if (!BANKS.includes(String(d.bank ?? ''))) errors.bank = 'Select a supported bank';
      break;
    case 'wallet':
      if (!WALLETS.includes(String(d.wallet ?? ''))) errors.wallet = 'Select a supported wallet';
      if (!/^\d{10}$/.test(String(d.mobile ?? ''))) errors.mobile = 'Enter the 10-digit wallet mobile number';
      break;
    default:
      errors.method = 'Unsupported payment method';
  }
  if (Object.keys(errors).length) throw badRequest('Invalid payment details', errors);

  if (method === 'credit_card' || method === 'debit_card') {
    const digits = String(d.cardNumber).replace(/\D/g, '');
    return { cardLast4: digits.slice(-4), nameOnCard: String(d.nameOnCard).trim() };
  }
  if (method === 'upi') {
    const [user, host] = String(d.upiId).split('@');
    return { upiId: `${user.slice(0, 2)}***@${host}` };
  }
  if (method === 'net_banking') return { bank: String(d.bank) };
  return { wallet: String(d.wallet), mobile: `******${String(d.mobile).slice(-4)}` };
}
