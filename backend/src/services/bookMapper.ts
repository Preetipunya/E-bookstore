import { deliveryEstimate, salePrice } from '../utils/pricing';

export const BOOK_SELECT = `
SELECT b.id, b.isbn, b.title, b.description, b.list_price, b.discount_percent, b.language, b.format, b.pages,
       b.published_date, b.rating_avg, b.rating_count, b.sales_count, b.is_featured,
       a.id AS author_id, a.name AS author_name,
       p.id AS publisher_id, p.name AS publisher_name,
       c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
       COALESCE(i.quantity, 0) AS stock
  FROM books b
  JOIN authors a ON a.id = b.author_id
  JOIN publishers p ON p.id = b.publisher_id
  JOIN categories c ON c.id = b.category_id
  LEFT JOIN inventory i ON i.book_id = b.id`;

export const PRICE_SQL = 'ROUND(b.list_price * (1 - b.discount_percent / 100.0), 2)';

export interface BookDto {
  id: number;
  isbn: string;
  title: string;
  description: string;
  author: { id: number; name: string };
  publisher: { id: number; name: string };
  category: { id: number; name: string; slug: string };
  listPrice: number;
  discountPercent: number;
  price: number;
  language: string;
  format: string;
  pages: number | null;
  publishedDate: string;
  rating: number;
  ratingCount: number;
  salesCount: number;
  featured: boolean;
  stock: number;
  inStock: boolean;
  lowStock: boolean;
  deliveryDate: string | null;
  coverUrl: string;
}

export function mapBook(r: any): BookDto {
  const stock = Number(r.stock);
  return {
    id: r.id,
    isbn: r.isbn,
    title: r.title,
    description: r.description,
    author: { id: r.author_id, name: r.author_name },
    publisher: { id: r.publisher_id, name: r.publisher_name },
    category: { id: r.category_id, name: r.category_name, slug: r.category_slug },
    listPrice: Number(r.list_price),
    discountPercent: Number(r.discount_percent),
    price: salePrice(Number(r.list_price), Number(r.discount_percent)),
    language: r.language,
    format: r.format,
    pages: r.pages,
    publishedDate: typeof r.published_date === 'string' ? r.published_date : new Date(r.published_date).toISOString().slice(0, 10),
    rating: Number(r.rating_avg),
    ratingCount: r.rating_count,
    salesCount: r.sales_count,
    featured: r.is_featured,
    stock,
    inStock: stock > 0,
    lowStock: stock > 0 && stock <= 5,
    deliveryDate: deliveryEstimate(stock > 0),
    coverUrl: `/api/books/${r.id}/cover.svg`,
  };
}
