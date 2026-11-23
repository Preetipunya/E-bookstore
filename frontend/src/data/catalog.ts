import raw from '../data/books.json';
import type { Book, Category } from '../types';

export const BOOKS = raw as Book[];

export const CATEGORIES: { name: Category; blurb: string; icon: string }[] = [
  { name: 'Fiction', blurb: 'Novels & stories', icon: 'M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2V5z M8 7h6M8 11h6' },
  { name: 'Non-Fiction', blurb: 'Real stories, real lives', icon: 'M12 3l9 4-9 4-9-4 9-4z M3 12l9 4 9-4 M3 17l9 4 9-4' },
  { name: 'Science', blurb: 'Curious about the universe', icon: 'M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3' },
  { name: 'Technology', blurb: 'Code, cloud & AI', icon: 'M4 5h16v11H4z M8 20h8M12 16v4' },
  { name: 'History', blurb: 'Learn from the past', icon: 'M12 7v5l3 2 M12 3a9 9 0 100 18 9 9 0 000-18z' },
  { name: 'Business', blurb: 'Lead, build, earn', icon: 'M3 8h18v12H3z M9 8V5h6v3' },
  { name: 'Self Help', blurb: 'Grow every day', icon: 'M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z' },
];

export const PUBLISHERS = Array.from(new Set(BOOKS.map((b) => b.publisher))).sort();

export const getBook = (id: number): Book | undefined => BOOKS.find((b) => b.id === id);

/** Same-category books, highest rated first, excluding the given book. */
export function recommendationsFor(book: Book, limit = 4): Book[] {
  return BOOKS.filter((b) => b.category === book.category && b.id !== book.id)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

/** Recommendations for a set of books: their categories first, then the best-rated rest. */
export function recommendationsForMany(owned: number[], limit = 8): Book[] {
  const cats = new Set(owned.map((id) => getBook(id)?.category).filter(Boolean));
  const pool = BOOKS.filter((b) => !owned.includes(b.id));
  const inCat = pool.filter((b) => cats.has(b.category)).sort((a, b) => b.rating - a.rating);
  const rest = pool.filter((b) => !cats.has(b.category)).sort((a, b) => b.rating - a.rating);
  return [...inCat, ...rest].slice(0, limit);
}
