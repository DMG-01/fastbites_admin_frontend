# FastBites API

This standalone Node.js API serves order data, waiter records, admin sign-in, and waiter application review actions without additional dependencies.

## Run locally

Use Node.js 20.6 or newer. Copy `.env.example` to `.env`, set the admin credentials, then run this from the backend folder:

```powershell
Copy-Item .env.example .env
npm start
```

In a second terminal, start the frontend from `frontend/`:

```powershell
Set-Location ..\frontend
$env:VITE_API_URL = "http://localhost:8000"
npm run dev
```

Sign in using the `ADMIN_USERNAME` and `ADMIN_PASSWORD` values. On first start, the API creates `backend/data.json` with sample orders, a waiter, and a pending waiter application. Changes are saved to that file; it is excluded from Git.

## API

Except for `GET /health` and `POST /admins/login`, endpoints require the bearer token returned by login. Login accepts URL-encoded `username` and `password`, matching the dashboard.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check API availability |
| `POST` | `/admins/login` | Sign in and receive an access token |
| `GET` | `/order` or `/orders` | List newest-first orders in groups of 10; supports `recipient`, `status`, `paymentStatus`, `waiter_settlement_status`, `include_unassigned`, and `page` filters |
| `POST` | `/order` | Create an order and record the received event |
| `PATCH` | `/order/:id` | Update order status, waiter assignment, payment, recipient, items, or total; changes are appended to its audit history |
| `GET` | `/order/:id/events` | Read the chronological order audit history |
| `GET` | `/waiter/` | List approved waiters |
| `PUT` | `/waiter/:id` | Update waiter details or active status |
| `POST` | `/waiter/requests` | Submit a waiter application with name, email, and Telegram ID |
| `GET` | `/waiter/requests` | List waiter applications; optional `?status=PENDING` |
| `PATCH` | `/waiter/requests/:id` | Review with `{"decision":"approve"}` or `{"decision":"reject"}` |

Approving a pending application marks it approved and adds the applicant to the waiter list. Rejecting marks it rejected. A reviewed application cannot be reviewed again.

The order details view displays the order's chronological activity. Assigning a waiter records an acceptance with the waiter's name; clearing the assignment records that waiter's drop. Status, payment, settlement, item, recipient, and total changes are also recorded. Existing orders receive an initial "Order received" event when the API starts after this update. Any service that changes orders must use the `PATCH /order/:id` endpoint for those changes to appear in the audit history.

## Configuration and deployment

`PORT` defaults to `8000`. Set `FRONTEND_ORIGIN` in `.env` to the exact dashboard origin when it is not `http://localhost:5173`. `DATA_FILE` can point to a different JSON data file.

This file-backed API is intended as a dependency-free local starting point. Admin credentials must be provided through environment variables; tokens are held in memory and expire after eight hours. For a multi-instance or production deployment, use a managed database and a production authentication/session system.
