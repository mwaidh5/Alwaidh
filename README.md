# Alwaidh Website

An online shop for **Computers**, **Solar Energy** products, and **Tiandy security cameras**.

Built with **React + Vite + TypeScript + Tailwind CSS**, ready for **Firebase Hosting** and a future **React Native** mobile app sharing the same product/types layer.

---

## Tech stack

- **Vite + React 18 + TypeScript** — fast dev server, instant HMR, production builds with code-splitting.
- **Tailwind CSS** — utility-first styling, responsive out of the box.
- **React Router** — client-side routing for Home, Category, Product, and Cart pages.
- **Firebase SDK** (preconfigured) — drop in your project credentials to enable Firestore (products), Auth (users), and Storage (images).
- **LocalStorage cart** — works offline; swap for a Firestore-backed cart later.

## Project layout

```
Alwaidh Website/
├── index.html                  # Vite entry HTML
├── package.json                # npm scripts + dependencies
├── vite.config.ts              # Vite config
├── tsconfig.json               # TypeScript config
├── tailwind.config.js          # Tailwind theme (brand colors etc.)
├── postcss.config.js
├── firebase.json               # Firebase Hosting config (SPA rewrite + caching)
├── .firebaserc                 # Firebase project alias — fill in your project ID
├── .env.example                # Copy to .env and fill in Firebase config
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx                # App bootstrap
    ├── App.tsx                 # Routes
    ├── index.css               # Tailwind layers + design tokens
    ├── firebase.ts             # Firebase client init (Firestore/Auth ready to uncomment)
    ├── vite-env.d.ts
    ├── types/product.ts        # Product, Category, CartItem types
    ├── lib/format.ts           # Price + className helpers
    ├── data/
    │   ├── categories.ts       # Computers, Solar, Tiandy Cameras
    │   └── products.ts         # Seed catalog — replace with Firestore later
    ├── context/CartContext.tsx # Cart state, persisted to localStorage
    ├── components/
    │   ├── Layout.tsx
    │   ├── Navbar.tsx
    │   ├── Footer.tsx
    │   ├── CategoryTile.tsx
    │   └── ProductCard.tsx
    └── pages/
        ├── Home.tsx            # Hero + 3-category grid + featured products
        ├── Category.tsx        # Sortable / in-stock filter
        ├── ProductDetail.tsx   # Specs + qty + add to cart
        ├── Cart.tsx            # Cart with quantity controls
        └── NotFound.tsx
```

## Get started

You'll need **Node.js 18+** and **npm**.

```bash
cd "Alwaidh Website"
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

## Firebase Hosting

1. Install the Firebase CLI: `npm install -g firebase-tools`
2. Log in: `firebase login`
3. Create a project at https://console.firebase.google.com if you don't have one.
4. Edit **`.firebaserc`** — replace `your-firebase-project-id` with your real Firebase project ID.
5. (Optional) Copy `.env.example` → `.env` and fill in the Firebase web app config so client-side SDKs work in the deployed app. Get those values from **Firebase Console → Project Settings → Your apps → Web app**.
6. Deploy:

```bash
npm run deploy
```

This runs `npm run build` then `firebase deploy --only hosting`.

`firebase.json` already includes the SPA rewrite (`** → /index.html`) and long-term caching headers for static assets.

## Wiring up Firestore for products

When you're ready to move products from `src/data/products.ts` into Firestore:

1. Uncomment the Firestore imports/exports in `src/firebase.ts`.
2. Create a `products` collection. Each document should match the `Product` interface in `src/types/product.ts`.
3. Replace `getProductsByCategory` and `getProduct` in `src/data/products.ts` with `getDocs` / `getDoc` calls, returning the same shapes. The UI won't change.

## Future mobile app

The site is set up to share its data model with a future React Native (Expo) app:

- All product/category shapes live in `src/types/product.ts` — copy that file into the RN project as-is.
- Firebase web SDK has a near-identical API for RN (`@react-native-firebase/*` or the modular JS SDK on Expo) — your `getProduct` / `getProductsByCategory` query helpers move over with minor import changes.
- The cart logic in `src/context/CartContext.tsx` is pure React + reducer — drop-in compatible with RN (swap `localStorage` for `AsyncStorage`).

## Customising

- **Brand colors** — edit `tailwind.config.js` (`colors.brand`, `colors.sun`).
- **Logo** — `src/components/Navbar.tsx` (the "A" badge) and `public/favicon.svg`.
- **Currency** — each product carries its own `currency` field (default `USD`); update seed data to `AED`, `SAR`, etc. as needed.

## Scripts

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start Vite dev server with HMR                |
| `npm run build`    | Type-check + production build to `dist/`     |
| `npm run preview`  | Serve the production build locally            |
| `npm run deploy`   | Build then deploy to Firebase Hosting         |

---

Happy building.
