# Entity Relationship Diagram

Source of truth: [`database/schema.sql`](../database/schema.sql).

```mermaid
erDiagram
  users ||--o{ addresses : has
  users ||--o{ refresh_tokens : owns
  users ||--o{ password_resets : requests
  users ||--o| carts : has
  carts ||--o{ cart_items : contains
  books ||--o{ cart_items : "in"
  users ||--o{ wishlist : saves
  books ||--o{ wishlist : "in"
  users ||--o{ orders : places
  addresses ||--o{ orders : "ship to (snapshot)"
  orders ||--o{ order_items : contains
  books ||--o{ order_items : "sold as"
  orders ||--o{ payments : "paid by"
  users ||--o{ payments : makes
  users ||--o{ reward_points : ledger
  orders ||--o{ reward_points : "earn/redeem"
  users ||--o{ reviews : writes
  books ||--o{ reviews : receives
  users ||--o{ recommendations : gets
  books ||--o{ recommendations : "recommended"
  users ||--o{ book_views : views
  books ||--o{ book_views : "viewed"
  users ||--o{ audit_logs : triggers
  authors ||--o{ books : writes
  publishers ||--o{ books : publishes
  categories ||--o{ books : classifies
  books ||--o{ book_images : has
  books ||--|| inventory : stocked

  users { int id PK
    string name
    string email UK
    string password_hash
    string phone
    int reward_balance }
  addresses { int id PK
    int user_id FK
    string full_name
    string phone
    string line1
    string line2
    string city
    string state
    string country
    string postal_code
    bool is_default }
  books { int id PK
    string isbn UK
    string title
    int author_id FK
    int publisher_id FK
    int category_id FK
    numeric list_price
    int discount_percent
    string language
    string format
    numeric rating_avg
    int sales_count }
  inventory { int book_id PK
    int quantity }
  orders { int id PK
    string order_number UK
    int user_id FK
    string status
    numeric subtotal
    numeric tax
    numeric shipping
    int points_redeemed
    numeric total
    timestamptz created_at }
  order_items { int id PK
    int order_id FK
    int book_id FK
    numeric unit_price
    int quantity }
  payments { int id PK
    int order_id FK
    string method
    string status
    numeric amount
    string transaction_ref UK }
  reward_points { int id PK
    int user_id FK
    int order_id FK
    int points
    string type
    int balance_after }
  coupons { int id PK
    string code UK
    string discount_type
    numeric value }
```

## Constraints highlights

| Area | Constraint |
|------|-----------|
| Users | unique `lower(email)`, `reward_balance >= 0` |
| Books | `list_price > 0`, `discount_percent 0..90`, `format IN (Paperback, Hardcover, eBook)`, unique ISBN |
| Inventory | `quantity >= 0` (prevents overselling at DB level) |
| Cart | one cart per user, unique `(cart_id, book_id)`, quantity 1..10 |
| Orders | status CHECK list, totals `>= 0`, address snapshotted into `ship_*` columns |
| Payments | method/status CHECK, unique `transaction_ref` |
| Reviews | rating 1..5, one review per user per book |
| Rewards | append-only ledger with `balance_after >= 0` |

## Key indexes

`ux_users_email`, `ix_books_category/author/publisher/price/rating/sales/published`, full-text GIN index on title+description, `ix_orders_user_created`, `ix_order_items_book`, `ix_reward_points_user`, `ix_recommendations_user`, `ix_audit_logs_entity`.
