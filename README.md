# NEXUS Community Library Management System

A full-stack web application built for Web Application Development Individual Assignment 2.

## Technology Stack
- **Frontend**: React 18, React Hooks, React Router DOM v6, Vite, Fetch API, Custom CSS with NEXUS Black & Gold aesthetic
- **Backend**: Node.js, Express.js REST API, bcryptjs password hashing, JWT authentication
- **Database**: MySQL (`library_db`) with relational tables for `users`, `books`, and `transactions`

---

## Getting Started

### 1. Database Setup
1. Start MySQL (e.g. through XAMPP or MySQL Workbench).
2. Ensure the database `library_db` is created and tables are initialized using `backend/schema.sql`.

### 2. Backend Setup (Port 5000)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the template environment file to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `backend/.env` and configure your settings:
   - Set `DB_PASSWORD` if your local MySQL instance has a root password.
   - Set `JWT_SECRET` to a secure, random secret key for token signing (required).
   - Set `ADMIN_PASSWORD` to your desired administrator password (required for seeding).
4. Install dependencies:
   ```bash
   npm install
   ```
5. Seed the database (initializes/updates the administrator account with your configured password and verifies starter books):
   ```bash
   npm run seed
   ```
6. Start the Express API server:
   ```bash
   npm start
   ```

### 3. Frontend Setup (Port 5173)
```bash
cd frontend
npm install
npm run dev      # Starts Vite dev server at http://localhost:5173
```

---

## Environment Variables Configuration

Copy `backend/.env.example` to `backend/.env`. The application reads the following variables:

| Variable | Description | Requirement | Example |
| :--- | :--- | :--- | :--- |
| `DB_HOST` | MySQL hostname | Optional (default: `localhost`) | `localhost` |
| `DB_USER` | MySQL username | Optional (default: `root`) | `root` |
| `DB_PASSWORD` | MySQL password | Optional (blank if no password) | `your_db_password` |
| `DB_NAME` | Database name | Optional (default: `library_db`) | `library_db` |
| `PORT` | API server port | Optional (default: `5000`) | `5000` |
| `JWT_SECRET` | Secret key used for signing JWT tokens | **Required** (server halts if missing) | `random_secret_32_chars_or_more` |
| `ADMIN_PASSWORD` | Secure password for administrator initialization/update | **Required for seed** | `YourSecureAdminPassword!` |
| `ADMIN_MEMBERSHIP_ID` | Administrator Membership ID | Optional (default: `ADMIN001`) | `ADMIN001` |
| `ADMIN_EMAIL` | Administrator contact email | Optional (default: `admin@nexus.local`) | `admin@nexus.local` |

---

## Authentication & User Accounts

### Administrator Account
- The administrator account is securely initialized or updated via `npm run seed` using the `ADMIN_PASSWORD` defined in your `backend/.env` file.
- The password is hashed using `bcrypt` (10 salt rounds) before persistence and is never stored in plain text or printed to the console.
- Default administrator Membership ID: `ADMIN001` (customizable via `ADMIN_MEMBERSHIP_ID`).
- Administrators have complete access to:
  - Admin Dashboard & inventory metrics
  - Book Management (full CRUD: create, edit, delete books)
  - Stock Management (adding new arrivals and deducting stock for damage/loss)
  - User Management (adding, updating, and removing users, with self-deletion protection)
  - Full transaction history across all library members

### Community Member Self-Registration
- Community members can create their own accounts via the **Create an account** link on the login page.
- Registration fields: Full name, Email address, unique/auto-generated Membership ID, Password (minimum 6 characters), and Password Confirmation.
- Public registration strictly assigns the `member` role — privilege escalation to administrator is blocked.
- After registration, members can immediately log in using their assigned Membership ID and password.
- Members can:
  - Browse available library titles
  - View real-time availability and low-stock indicators
  - Borrow available books
  - Return currently borrowed books
  - View their personal borrowing and transaction history

---

## Core Features
- **Member Registration & Secure Authentication**: BCrypt hashing, mandatory JWT signing with environment secret, role separation.
- **Book Management**: Full CRUD (add, update, delete) for administrators; book catalog search and filtering for members.
- **Stock Management & Low Stock Alerting**: Add/deduct inventory, visual badges for low stock (< 2 copies) and out of stock.
- **Borrowing & Returning System**: Community members can borrow available titles and return them with live stock tracking.
- **Transaction History**: Audit trail of stock additions, deductions, borrowings, and returns.
- **Admin Dashboard**: Visual statistics for inventory, copies in stock, low-stock warnings, members, and total transactions.
