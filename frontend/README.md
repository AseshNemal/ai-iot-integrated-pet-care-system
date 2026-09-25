# Pet Wellness Hub Frontend

React frontend for the AI- and IoT-Integrated Pet Care System. It includes pet
profiles and medical records, appointments, adoption, shopping and order history,
AI-assisted training, notifications, feedback, and the connected health dashboard.

For full backend, security, IoT, and environment setup, see the
[repository README](../README.md).

## Local Development

Prerequisites:

- Node.js and npm
- The Express API running locally (port `8090` by default)
- A populated `frontend/.env` based on `.env.example`

Install and run:

```bash
npm install
npm start
```

The development server is available at [http://localhost:3000](http://localhost:3000).

### Environment Configuration

The frontend uses `src/config/api.js` as the shared backend origin:

```env
REACT_APP_API_BASE_URL=http://localhost:8090
```

When the variable is unset, the application falls back to
`http://localhost:8090`. Restart the development server after changing any `.env`
value. Firebase, Google Maps, and optional IoT simulator variables are documented in
`.env.example`.

Do not commit a populated `.env` file or credentials.

## Available Scripts

| Command | Purpose |
|---|---|
| `npm start` | Run the development server with hot reload |
| `npm test` | Run the Create React App test runner in watch mode |
| `npm run build` | Create an optimized production build in `build/` |

## Customer Store and Orders

### Routes

| Route | Component | Access |
|---|---|---|
| `/product/all` | `src/components/storePage.js` | Public catalog browsing |
| `/payment` | `src/components/PaymentPage.js` | Checkout UI; order creation requires a session |
| `/my-orders` | `src/components/MyOrdersPage.js` | Authenticated order history |
| `/adminDashboard/product` | `src/components/adminProducts.js` | Product administration |

### Storefront Behavior

The storefront provides:

- Search across product names, categories, and descriptions
- Category filters derived from the returned catalog
- Featured, price, and name sorting
- Low-stock and out-of-stock indicators
- A product-detail dialog with bounded quantity selection
- An in-memory cart drawer with subtotal calculation and item removal
- Loading, retryable API-error, empty-result, and missing-image states
- Keyboard-visible focus styles, Escape-to-close dialogs, body scroll locking, and
  reduced-motion support

Product data is loaded from `GET /product/all`. Relative product image paths are
resolved against `REACT_APP_API_BASE_URL`; absolute HTTP(S) image URLs are preserved.

The cart is component state and does not persist across a page reload. Adding an item
to the cart reduces only the catalog's local display stock. Persistent stock changes
are made later by the checkout flow.

### Checkout and Order History

The checkout page receives `{ cart, totalValue }` through React Router navigation
state. It creates the order and then calls the stock-reduction endpoint for each cart
item. The My Orders page:

1. Requests the current session from `GET /get-session` with browser credentials.
2. Shows a signed-out state when no user identity is present.
3. Requests `GET /order/user/:userId` with `withCredentials: true`.
4. Presents aggregate order/item/spending totals and newest/oldest sorting.
5. Displays each order as line items with quantities, unit prices, line totals, and
   the stored order total.

Do not remove the credential options from protected requests. The backend uses a
server-side session cookie and returns `401` when that cookie is absent or invalid.

### Current Payment Limitations

- The card form performs client-side validation only.
- No Stripe, PayPal, or other payment processor is integrated.
- Card details are not sent to a payment gateway.
- Order creation and per-item stock reduction are separate API operations rather
  than one database transaction. A production checkout should make these operations
  atomic on the server and validate current prices and stock there.

## Visual System

Customer-facing redesigned pages use the same compact design vocabulary as the home
page:

| Token | Value | Usage |
|---|---|---|
| Ink | `#172033` | Primary text |
| Muted | `#5f6b7a` | Secondary text |
| Primary | `#4f6ef7` | Actions, links, focus accents |
| Primary dark | `#263a6b` | High-emphasis surfaces and actions |
| Border | `#e3e8f0` | Dividers and card outlines |
| Tint | `#f5f7fb` | Alternate sections and subtle surfaces |

The store styles are scoped under `.store-page` in `src/storePage.css`; order-history
styles are scoped under `.orders-page` in `src/myOrderPage.css`. Keep new selectors
inside the page namespace to avoid collisions with the remaining legacy stylesheets.

Both pages use responsive layouts for desktop, tablet, and narrow mobile viewports.
When changing their structure, verify at least a desktop width and a 390px mobile
viewport, including dialogs, long product names, multi-item orders, empty states, and
API-error states.

## Relevant Files

```text
src/components/storePage.js       Store catalog, product dialog, and cart
src/storePage.css                 Store visual and responsive styles
src/components/MyOrdersPage.js    Session-aware customer order history
src/myOrderPage.css               Order-history visual and responsive styles
src/components/PaymentPage.js     Checkout form and order submission
src/config/api.js                 Deployable backend base URL
src/App.js                        Route registration and shared layout
```

## Production Build

```bash
npm run build
```

The build may report lint warnings from older components. New work should not add
warnings. Treat a successful optimized build as the minimum verification step, then
visually check the affected routes and responsive states in a browser.
