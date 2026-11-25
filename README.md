# Subs

A phone-first, local-only subscription tracker at **https://subs.junyahonda.com**.

## Run

Node.js 22 or newer is required.

```sh
npm ci
npm run dev
```

`npm test` runs date, money, backup validation, and calendar tests. `npm run build` creates `dist/`; `npm start` previews the build on port 3000. No environment variables, server, account, bank connection, or API key is needed. There are no pre-commit hooks.

## Features

- Add, edit, delete, pause, and search subscriptions; track free trials separately.
- Monthly and yearly run-rate totals, normalized from weekly/monthly/quarterly/yearly charges. Trials and paused subscriptions are excluded. Weekly charges use 52 weeks/year.
- Multiple currencies stay separate; use the summary currency selector to view each. No exchange rates or currency conversion.
- Calendar-aware renewals preserve original billing dates and clamp month ends without drifting.
- Free trials stay flagged after their end date until explicitly changed or paused.
- Configurable in-app reminder lead time and calendar (.ics) export.
- JSON export/restore, installable PWA, offline after the first successful load.

## Privacy and reminders

Subscription details live in localStorage under `subs.v1` in the current browser. No analytics or data API is used. Fonts are loaded from Google Fonts, with local system fallbacks. Clearing site data deletes the list; private browsing may not retain it. Export a backup before moving phones or browsers.

**A static local-only app cannot reliably schedule background phone notifications.** In-app warnings appear while Subs is open. On Android, use the per-reminder **Google Calendar** link to open a prefilled event, verify its notification, and save it. Alternatively, download the calendar file and import it into a calendar with notifications enabled. Google Calendar imports .ics files through its desktop website, not its Android app; the direct event link avoids that desktop requirement. Reminders are one-time timed events for each next charge, normally at 9 AM local time on the selected lead day. If that time has passed, they are set 15 minutes after export, with an at-start display alarm. Save/import urgent reminders promptly. Import behavior and notification delivery depend on the calendar app and phone settings. Add events again after a renewal or edit. Calendar actions are optional and share those event details with the selected calendar provider only when the user opens/imports them.

Paused/canceled is a tracking status only: cancel billing with the provider. Subs does not cancel subscriptions or detect actual charges.

## Deploy

GitHub Actions runs checks on pushes and PRs; the main branch deploys the production build to GitHub Pages. In repository **Settings → Pages**, select **GitHub Actions**, set **subs.junyahonda.com** as the custom domain, then enable HTTPS once GitHub has provisioned the certificate.

Namecheap DNS needs only `CNAME subs → junyahonda.github.io` (Automatic TTL). Do not change the apex or other records. `public/CNAME` is included in the build. The app is designed for the root of its custom domain, not a GitHub project path.

The production build fingerprints its complete output and stamps the HTML and service worker with the same version. The service worker precaches a complete release (including its hashed JS/CSS), then activates it atomically; a partial or stale CDN response leaves the existing offline release working. Only `subs-shell-*` caches are removed; subscription data is never touched.

Online installed copies check for updates on launch, resume, reconnection, and every minute while visible. A new worker refreshes the page automatically once no dialog or input is active, so an Add/Edit draft is not discarded. The first upgrade from the original, unversioned worker also refreshes visible legacy clients after activation. A legacy copy already suspended in memory still depends on the browser's next worker update check (normally a full app launch); code cannot add resume listeners to a document that has not loaded it yet. After this one-time bootstrap, warm resumes are checked explicitly. Offline copies keep their complete cached release until connectivity returns.
