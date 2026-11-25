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

**A static local-only app cannot reliably schedule background phone notifications.** In-app warnings appear while Subs is open. To receive alerts with Subs closed, download the calendar file and import it into a calendar with notifications enabled. Google Calendar imports .ics files through its desktop website, not its Android app. Calendar exports contain one-time reminders for each next charge, on the chosen number of days beforehand, with an all-day event and a 9 AM display alarm. Import behavior and notification delivery depend on the calendar app and phone settings. Export/import again after a renewal or edit. Importing calendar events is optional and sends those event details to the calendar provider selected by the user; Subs itself never uploads them.

Paused/canceled is a tracking status only: cancel billing with the provider. Subs does not cancel subscriptions or detect actual charges.

## Deploy

GitHub Actions runs checks on pushes and PRs; the main branch deploys the production build to GitHub Pages. In repository **Settings → Pages**, select **GitHub Actions**, set **subs.junyahonda.com** as the custom domain, then enable HTTPS once GitHub has provisioned the certificate.

Namecheap DNS needs only `CNAME subs → junyahonda.github.io` (Automatic TTL). Do not change the apex or other records. `public/CNAME` is included in the build. The app is designed for the root of its custom domain, not a GitHub project path.

The service worker uses network-first caching for same-origin files. Assets are cached during normal loading and are available offline afterward; production updates load online automatically.
