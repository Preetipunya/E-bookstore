# Book Worm - Frontend-only Bookstore

A React + TypeScript + Vite + Tailwind CSS + React Router bookstore. There is no backend, database or API.
Books come from a local JSON file, and all user data lives in the browser's `localStorage`.

## Run

```
cd frontend
npm install
npm run dev
```

## Features

| Area | Where |
|------|-------|
| Register / login / logout (users in localStorage) | `src/context/AuthContext.tsx`, `src/pages/AuthPage.tsx` |
| Home: hero, categories, featured, best sellers, recommendations, publishers | `src/pages/Home.tsx` |
| Catalogue: search, category / price / publisher filters, sort by price and rating | `src/pages/Catalog.tsx` |
| Product details: Add to Cart, Buy Now, Wishlist, related books | `src/pages/BookDetails.tsx` |
| Cart (persisted): add, remove, quantity, total, continue shopping | `src/pages/Cart.tsx` |
| Wishlist (persisted): add, remove, move to cart | `src/pages/Wishlist.tsx` |
| Addresses: add, edit, delete, select at checkout | `src/pages/Addresses.tsx`, `src/components/AddressForm.tsx` |
| Checkout: address, summary, reward points, payment | `src/pages/Checkout.tsx` |
| Payment simulator: card / UPI / wallet, 2s spinner, fake transaction ID | `src/pages/Checkout.tsx` |
| Confirmation page | `src/pages/Confirmation.tsx` |
| Orders: history, details, Buy Again, cancel within 48h | `src/pages/Orders.tsx` |
| Reward points: +10 per order, redeem at checkout, adjusted on cancel | `src/context/ShopContext.tsx` |

## Notes

- **Data**: `src/data/books.json` holds 36 books across the 7 categories. Covers are generated SVGs (`src/utils/cover.ts`), so no image files are needed.
- **Rules**: 1 point = Rs 1, up to 50% of an order. New accounts get 50 welcome points. Shipping is Rs 49, free at Rs 499 or more.
- **Cancellation**: allowed while `now - order.createdAt < 48h`. It returns redeemed points and removes the points earned on that order.
- **Recommendations**: same category first, then highest rated. They exclude books you already bought.
- **Passwords**: stored in plain text in localStorage. This is for the demo only.
- **Reset data**: clear site data for the page. All keys start with `bw.`.

## Structure

```
frontend/src
  components/  Navbar, Footer, BookCard, BookRail, SearchBar, AddressForm, Breadcrumbs, ...
  pages/       Home, Catalog, BookDetails, Cart, Wishlist, Addresses, Checkout, Confirmation, Orders, AuthPage
  context/     Auth, Shop (cart / wishlist / addresses / orders / points), Toast
  hooks/       useDebounce, useFakeLoading
  data/        books.json, catalog.ts
  utils/       storage, format, cover
  assets/      (covers are generated in code; the favicon is in public/)
```
