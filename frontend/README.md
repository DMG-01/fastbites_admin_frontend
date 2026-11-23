# FastBites Admin Frontend

The React/Vite dashboard lives in this folder. See the [backend setup](../backend/README.md) to start the API.

## Run locally

Use Node.js 20 or newer. From this folder:

```powershell
npm install
$env:VITE_API_URL = "http://localhost:8000"
npm run dev
```

The dashboard uses the API for admin login, order listing, and waiter management. Waiter records and applications are grouped under `/waiters`; `/waiters/requests` opens the Applications tab, and the previous `/waiter-requests` URL redirects there.

## Validate

```powershell
npm run build
npm run lint
```
