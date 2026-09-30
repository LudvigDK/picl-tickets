# Picl Events

A frontend-only event and ticket app for **events.picl.dk**, built with React, TypeScript, Vite, Firebase Authentication, and Cloud Firestore. GitHub Pages serves all application files. No app server, Cloud Functions, payment API credentials, ticket delivery, or check-in system is required.

## Run locally

Use Node.js 22 and pnpm (the version is pinned in `package.json`).

```sh
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Without Firebase configuration you can use the creator’s live preview and the read-only example at `/#/demo`. Publishing and real event access are disabled. There is no local-storage event database or fake publishing fallback.

## Connect Firebase

1. Create a Firebase project and register a Web app. Copy its public web configuration from Project settings → Your apps.
2. Create a **Cloud Firestore** database. Use production mode, then replace its rules with the complete contents of `firestore.rules` and publish them. Do not leave test-mode rules deployed.
3. In Authentication → Sign-in method, enable **Email/Password**. No buyer sign-in or anonymous authentication is needed.
4. In Authentication → Settings → Authorized domains, add `events.picl.dk`, your `YOUR_USERNAME.github.io` domain, and `localhost` for development.
5. Fill in the four required `VITE_FIREBASE_*` values in `.env`. Restart the dev server after changing `.env`.

Alternatively, copy `public/firebase-config.example.json` to `public/firebase-config.json` and fill in the same configuration. The app reads this at startup when build-time configuration is absent. Firebase web config is public information; never add a service-account key or admin credentials to the frontend. Database rules enforce write access.

To deploy rules with the Firebase CLI instead of the console:

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```

### Editing passwords and security

Each event gets a separate Firebase Auth account, using a deterministic internal email `event-EVENT_ID@events.picl.dk` and the editing password chosen by its organizer. Firebase stores and checks the password; the event document contains **no password, password hash, or editing secret**. Creating another event makes another account, so each event has its own password.

Firestore rules permit public reads of a known event, deny event-list queries, and restrict edits to that event’s owner UID. Owner UID and creation timestamp are immutable; every edit increments a revision. A transaction prevents one editing session from silently overwriting another. Editing authentication lasts for the browser tab session; “Lock editing” signs out. The editing URL contains only the event ID and still requires the password in another session.

Keep the password and event link: there is no organizer inbox or automatic password reset. If necessary, a Firebase administrator can reset the event account’s password in the Firebase console. Enable a project password policy compatible with the app’s minimum of 10 characters. Firebase sign-up rate limits still apply, and public event creation can consume your Firebase quota.

## Use the app

- **Create:** `/#/create` — title, description, optional Copenhagen date/time and location, up to six ticket types, DKK prices, limits, sold-out switches, up to four required fields per ticket, a MobilePay Box share link, and an editing password.
- **Guest event:** `/#/event/EVENT_ID` — select quantities and complete a separate set of fields for every ticket. Mobile visitors open MobilePay; desktop visitors get a locally generated QR code and payment link.
- **Edit:** `/#/event/EVENT_ID/edit` — unlock with the original password, update the event, mark tickets sold out, and save. The creator includes separate guest and editing links.

Hash routing works on GitHub Pages without server rewrites. Event IDs come from Firestore; share links use those persisted IDs and the current host, so they work under a GitHub repository path too. Buyers see live edits, and checkout performs a fresh server read before producing a payment link.

## MobilePay Box links

Open your Box in the MobilePay app, choose **Share**, and copy the full HTTPS link:

```text
https://qr.mobilepay.dk/box/BOX_UUID/pay-in
```

A short Box number is not sufficient for the current share-link format. The app validates the host and UUID path, discards any copied amount/message, and generates:

```text
https://qr.mobilepay.dk/box/BOX_UUID/pay-in?amount=25000&message=URL_ENCODED_MESSAGE
```

`amount` is in **øre**: 25000 = 250 DKK. The message includes an event reference, quantity, ticket name, full ticket ID, and numbered answers for each ticket. Example:

```text
E:aBcD12 | 2x Entry[ABCD1234];1:Name=Anna;2:Name=Bo
```

The current official Box landing page was checked with a public shared Box URL: `amount=1500` rendered as **15,00 kr.** and `message=Test` rendered as **Test**. This is the Box share-link format, not the old business `phone/amount/comment/lock` format. The Box links are not documented as a stable developer API. Before taking your event live, test a generated link and QR code against **your own Box** on an actual phone and verify the recipient, amount, and message. No real payment was made during development.

The app uses a conservative **140-character application limit** for payment messages and refuses overflow instead of truncating guest details. Short field labels/names help; long messages may require fewer tickets in a checkout. All answers are included in the URL/QR and sent to MobilePay/the organizer; the app does not persist buyer answers in Firestore, browser storage, or analytics. Repeated requests can still appear in browser history and MobilePay’s own systems.

### Boundaries of a frontend + Box workflow

- “Max. per person” is enforced **per checkout**. Without buyer identity or verified payment callbacks, this app cannot enforce a lifetime/per-event limit across repeat purchases, devices, or directly edited payment links. Check repeat purchases in MobilePay.
- Availability is set manually by the organizer. Opening a payment link does **not** reserve a ticket or prove a transfer, and there is no automatic inventory decrement. A change after a QR/link has been generated cannot revoke that external link. Refreshing the event clears an open payment QR when the event revision changes.
- Amounts and messages are prefilled. A Box share link does not provide a verified, locked purchase. Confirm transfers and guest details in MobilePay, where check-in also happens.
- No ticket, receipt email, purchase record, payment success claim, or check-in feature is generated by this site.

## Deploy to GitHub Pages

1. Push this project to a GitHub repository using the `main` branch.
2. In repository Settings → Pages → Build and deployment, choose **GitHub Actions**.
3. Configure Firebase either in `public/firebase-config.json`, or add these repository **Actions variables**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
4. Push to `main` or run the **Deploy Picl Events to GitHub Pages** workflow. It installs dependencies, runs unit tests, builds static files, and publishes `dist/`.
5. In Pages settings, set the custom domain to `events.picl.dk`. `public/CNAME` is included in the build. Add a DNS CNAME for `events` pointing to `YOUR_USERNAME.github.io` (no protocol or path), then enable **Enforce HTTPS** when GitHub issues the certificate. You can initially test the default GitHub Pages URL; remove/change CNAME if you want to host elsewhere.

The Pages workflow does not deploy Firebase rules; publish them separately before using the app. No project credentials, repository remote, or DNS changes have been supplied or made automatically.

## Checks

```sh
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Unit tests cover cents-safe pricing, link validation/encoding, multiple per-ticket answers, quantity limits, sold-out rejection, message overflow, and Unicode field definitions. Browser tests cover the creator, custom-field controls, guest checkout, sold-out tickets, required per-ticket answers, invalid routes, and mobile layout. Browser tests use the explicitly read-only example.

For local Firebase integration, install the Firebase CLI and a compatible Java runtime, then run:

```sh
npx firebase-tools emulators:start --project demo-picl-events --only auth,firestore
```

Use `.env` values `VITE_FIREBASE_API_KEY=demo-key`, `VITE_FIREBASE_AUTH_DOMAIN=demo-picl-events.firebaseapp.com`, `VITE_FIREBASE_PROJECT_ID=demo-picl-events`, `VITE_FIREBASE_APP_ID=demo-app`, and `VITE_USE_FIREBASE_EMULATORS=true`. Restart Vite. Emulators are only connected in development builds, never the production GitHub Pages build.

With the emulators running, execute the database integration tests:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm test
```

These tests create disposable events in the `demo-picl-events` emulator and verify public reads, denied listing/unauthorized edits, password unlock, sold-out persistence, immutable ownership, invalid content rejection, stale revision conflicts, and creation/editing at the full supported schema size. They are skipped by the ordinary test command when the emulator environment variable is absent. Custom field definitions are stored as compact `ID:type:label` strings so the schema fits Firestore’s rule-expression budget; the app converts them to structured fields on read.

## Visual direction

Pickle greens, a warm cream canvas, custom SVG pickle illustrations, and rounded ticket controls. `picl.dk` returned a parked landing page during development, so its live typography/assets could not be matched. All app copy is English; prices use Danish currency formatting.
