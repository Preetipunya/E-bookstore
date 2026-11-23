export type Category = 'Fiction' | 'Non-Fiction' | 'Science' | 'Technology' | 'History' | 'Business' | 'Self Help';

export interface Book {
  id: number;
  title: string;
  author: string;
  publisher: string;
  category: Category;
  /** Cover art token, e.g. "cover://rose" - resolved to an SVG by utils/cover.ts */
  image: string;
  price: number;
  rating: number;
  bestseller: boolean;
  featured: boolean;
  description: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  /** NOTE: demo only - a real app must never store plain-text passwords. */
  password: string;
}

export interface CartItem {
  bookId: number;
  quantity: number;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface OrderItem {
  bookId: number;
  title: string;
  author: string;
  image: string;
  price: number;
  quantity: number;
}

export type OrderStatus = 'Confirmed' | 'Cancelled';
export type PaymentMethod = 'Credit Card' | 'Debit Card' | 'UPI' | 'Wallet';

export interface Order {
  id: string;
  userId: string;
  createdAt: string; // ISO timestamp
  items: OrderItem[];
  address: Address;
  subtotal: number;
  shipping: number;
  pointsRedeemed: number;
  total: number;
  pointsEarned: number;
  paymentMethod: PaymentMethod;
  transactionId: string;
  status: OrderStatus;
  cancelledAt?: string;
}

export interface CheckoutDraft {
  /** Set when "Buy Now" is used: checkout only this single book instead of the cart. */
  buyNowBookId?: number;
  addressId?: string;
  pointsToRedeem: number;
}
