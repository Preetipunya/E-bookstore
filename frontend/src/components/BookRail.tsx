import { Link } from 'react-router-dom';
import type { Book } from '../types';
import { BookCover } from './BookCard';
import Stars from './Stars';
import { formatPrice } from '../utils/format';

/** Compact vertical card for horizontal scrolling rails (home page, recommendations). */
export function BookTile({ book }: { book: Book }) {
  return (
    <Link to={`/books/${book.id}`} className="group block w-36 shrink-0 snap-start sm:w-44">
      <BookCover book={book} className="transition group-hover:-translate-y-1 group-hover:shadow-brand-500/20" />
      <p className="mt-2 line-clamp-2 text-sm font-medium text-white group-hover:text-brand-400">{book.title}</p>
      <p className="truncate text-xs text-slate-400">{book.author}</p>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-white">{formatPrice(book.price)}</span>
        <Stars rating={book.rating} showValue={false} />
      </div>
    </Link>
  );
}

export default function BookRail({ title, books, action }: { title: string; books: Book[]; action?: { label: string; to: string } }) {
  if (!books.length) return null;
  return (
    <section className="mt-10" aria-label={title}>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {action && <Link to={action.to} className="text-sm text-brand-400 hover:underline">{action.label} →</Link>}
      </div>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {books.map((b) => <BookTile key={b.id} book={b} />)}
      </div>
    </section>
  );
}
