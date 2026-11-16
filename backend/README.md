# NEXUS Library Backend API

Node.js + Express REST API backed by MySQL (`library_db`).

## Installation & Setup

1. Import `schema.sql` into MySQL:
   ```bash
   mysql -u root < schema.sql
   ```
2. Configure environment variables:
   Copy `.env.example` to `.env` and configure:
   - `JWT_SECRET` (Required): Secret key used for signing authentication tokens.
   - `ADMIN_PASSWORD` (Required for seed): Password to initialize/update the admin account.
   - Database connection settings (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Seed the database (initializes/updates admin using configured `ADMIN_PASSWORD` and sets up starter books):
   ```bash
   npm run seed
   ```
5. Start server:
   ```bash
   npm start
   ```

## API Endpoints

### Authentication & Users
- `POST /users/login` - Authenticate using `membership_id` and `password`. Returns user profile and JWT.
- `POST /users/register` - Public self-registration for community members (forces role to `member`).
- `GET /users` - List all users (*Admin only*).
- `POST /users` - Create a user (*Admin only*).
- `PUT /users/:id` - Update user profile (*Admin or Self*).
- `DELETE /users/:id` - Delete user account (*Admin only*, self-deletion blocked).

### Books
- `GET /books` - View all books (Public / Members / Admin).
- `GET /books/:id` - View single book.
- `POST /books` - Add a new book (*Admin only*).
- `PUT /books/:id` - Update book details (*Admin only*).
- `DELETE /books/:id` - Delete a book (*Admin only*).

### Transactions
- `GET /transactions` - Fetch transaction history (Admins see all records; Members see their own records).
- `POST /transactions` - Record a transaction:
  - `add`: Add book stock (*Admin only*).
  - `deduct`: Deduct book stock (*Admin only*).
  - `borrow`: Member borrows a book (decrements stock).
  - `return`: Member returns a book (increments stock).
