import { isExpired, luhn, parseExpiry, validatePaymentDetails } from '../../src/utils/paymentValidation';
import { coverSvg, wrapText } from '../../src/utils/coverSvg';

describe('luhn', () => {
  it('accepts valid test card numbers', () => {
    expect(luhn('4242 4242 4242 4242')).toBe(true);
    expect(luhn('5555555555554444')).toBe(true);
  });
  it('rejects invalid numbers', () => {
    expect(luhn('4242 4242 4242 4241')).toBe(false);
    expect(luhn('1234')).toBe(false);
    expect(luhn('abcd efgh ijkl mnop')).toBe(false);
  });
});

describe('expiry', () => {
  it('parses MM/YY and MM/YYYY', () => {
    expect(parseExpiry('08/27')).toEqual({ month: 8, year: 2027 });
    expect(parseExpiry('08/2027')).toEqual({ month: 8, year: 2027 });
    expect(parseExpiry('13/27')).toBeNull();
    expect(parseExpiry('nope')).toBeNull();
  });
  it('treats the expiry month as valid through its last day', () => {
    expect(isExpired({ month: 1, year: 2025 }, new Date('2025-01-31T23:00:00Z'))).toBe(false);
    expect(isExpired({ month: 1, year: 2025 }, new Date('2025-02-01T00:00:01Z'))).toBe(true);
  });
});

describe('validatePaymentDetails', () => {
  const card = { cardNumber: '4242424242424242', nameOnCard: 'A B', expiry: '12/35', cvv: '123' };

  it('masks card details (never returns PAN or CVV)', () => {
    const m = validatePaymentDetails('credit_card', card);
    expect(m).toEqual({ cardLast4: '4242', nameOnCard: 'A B' });
    expect(JSON.stringify(m)).not.toContain('4242424242424242');
  });
  it('reports every invalid card field', () => {
    try {
      validatePaymentDetails('debit_card', { cardNumber: '1111', nameOnCard: '', expiry: '01/20', cvv: '1' });
      fail('should throw');
    } catch (e: any) {
      expect(Object.keys(e.details).sort()).toEqual(['cardNumber', 'cvv', 'expiry', 'nameOnCard']);
    }
  });
  it('validates and masks UPI', () => {
    expect(validatePaymentDetails('upi', { upiId: 'rahul@okbank' })).toEqual({ upiId: 'ra***@okbank' });
    expect(() => validatePaymentDetails('upi', { upiId: 'bad' })).toThrow();
  });
  it('validates net banking and wallet', () => {
    expect(validatePaymentDetails('net_banking', { bank: 'HDFC Bank' })).toEqual({ bank: 'HDFC Bank' });
    expect(() => validatePaymentDetails('net_banking', { bank: 'Fake Bank' })).toThrow();
    expect(validatePaymentDetails('wallet', { wallet: 'Paytm', mobile: '9876543210' })).toEqual({ wallet: 'Paytm', mobile: '******3210' });
    expect(() => validatePaymentDetails('wallet', { wallet: 'Paytm', mobile: '123' })).toThrow();
  });
});

describe('coverSvg', () => {
  it('wraps and truncates text', () => {
    expect(wrapText('a b c d e f g h', 3, 2).length).toBe(2);
    expect(wrapText('short', 20, 2)).toEqual(['short']);
  });
  it('renders escaped, valid-looking SVG', () => {
    const svg = coverSvg({ id: 1, title: 'Tom & <Jerry>', author: 'A. "Writer"', description: 'x', color1: '#111111', color2: '#222222', category: 'Fun' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('TOM &amp; &lt;JERRY&gt;');
    expect(svg).not.toContain('<Jerry>');
  });
  it('renders a back cover', () => {
    expect(coverSvg({ id: 2, title: 'T', author: 'A', description: 'some description text', color1: '#111111', color2: '#222222', category: 'Fun' }, 'back')).toContain('some description');
  });
});
