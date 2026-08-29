# Smokeless

[![GitHub stars](https://img.shields.io/github/stars/plungarini/smokeless-web?style=social)](https://github.com/plungarini/smokeless-web)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-donate-ffdd00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wheresbebo)

An offline-first PWA for tracking every cigarette, following a quit program, and watching the trend bend down.

Log a smoke in one tap. Watch a live timer count up from your last one. See a weighted view of where your habit is heading, not just a raw daily tally. It installs like a native app and keeps working with no signal — writes sync to Firestore the moment you're back online.

> [!IMPORTANT]
> **⭐ Star this repo if Smokeless is helping you quit.**
> It's the only feedback signal this side project gets, and it's how other people find it. [Click here](https://github.com/plungarini/smokeless-web) 🙏

## Features

- **Home** — today's count, a live timer since your last cigarette, and your longest smoke-free streak (today and all-time).
- **Stats** — a weighted trend by week, month, or year, with period-over-period comparison and average time between cigarettes.
- **History** — a calendar of every logged day; tap a date to review, add, or delete entries.
- **Settings** — export your full log as JSON, Google or email sign-in, and a typed-confirmation wipe.

## Run it locally

```bash
npm install
cp .env.example .env   # fill in your Firebase web config (VITE_FIREBASE_*)
npm run dev            # http://localhost:5174
```

`npm run build` produces `dist/`; `npm start` serves it with a tiny Express server (`server.mjs`) for Firebase App Hosting.

## Tech

React 19 · Vite · Tailwind CSS v4 · Firebase Auth + Firestore (offline persistence) · vite-plugin-pwa

## Support

<div align="center">

Smokeless is free, ad-free, and unaffiliated. A coffee or a star keeps it that way.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-donate-ffdd00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wheresbebo)
&nbsp;
[![Star on GitHub](https://img.shields.io/github/stars/plungarini/smokeless-web?style=for-the-badge&logo=github&label=Star%20this%20repo&color=yellow)](https://github.com/plungarini/smokeless-web)

</div>

## License

MIT licensed.
