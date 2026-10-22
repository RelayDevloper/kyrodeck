# KyroDeck

<p align="center">
  <img src="./src/assets/kyrodeck-logo.png" alt="KyroDeck logo" width="180" />
</p>

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Deploy on Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify&logoColor=white)](https://www.netlify.com/)

**Build. Inspect. Debug.**

KyroDeck is a browser-first developer workspace with seven practical tools: JSON formatting and validation, a secret-pattern scanner, a local snippet vault, line diffs, a regular-expression tester, a text deobfuscator, and an HTTP status/header reference.

## Requirements

- Node.js 20 or newer
- npm

## Install and develop

```sh
npm install
npm run dev
```

Vite prints the local development URL when the server is ready.

## Build and test

```sh
npm test
npm run build
npm run preview
```

The production site is written to `dist/`. The preview command serves that built output locally.

## Deploy to Netlify

Connect this repository to Netlify. The included `netlify.toml` configures the production build command (`npm run build`), publish directory (`dist`), and SPA fallback. No environment variables, server, account system, external API, or paid service is required.

## Privacy and local data

Tool processing runs in the browser. KyroDeck does not make API requests or upload pasted JSON, source code, headers, regex input, or snippets. Snippets and preferences are stored in this browser's LocalStorage; they are not synced or automatically shared across devices. Use Settings to import/export snippets or clear local data. Browser storage may be unavailable or quota-limited, in which case KyroDeck shows a warning and changes may not persist.

The bundled application works without a network connection after it has loaded. It does not register a service worker, so a fresh page load still requires the site files to be available from the host or browser cache.

## Features and limitations

- **JSON Toolkit:** format, minify, validate, recursively sort keys, copy, download, clear, swap, and load an example.
- **Secret Scanner:** detects common key/token/password assignments and private-key headers; previews are masked and findings can be dismissed. Detection is heuristic, can miss secrets, and can flag test values. It is not a complete secret audit.
- **Snippet Vault:** create, edit, delete, search, filter by language/favorites, copy, and import/export JSON. Built-in examples can be removed. Data stays in the current browser.
- **Code Diff:** compare added, removed, and unchanged lines in split or unified views, optionally ignoring whitespace. Inputs over 500 KB are declined to keep the page responsive.
- **Regex Tester:** uses JavaScript's native regular-expression engine, includes examples and flag controls, shows highlighted matches, positions, numbered and named capture groups, and previews replacements. Results are capped at 500. Pathological expressions can still consume significant CPU; avoid untrusted patterns and very large input.
- **Deobfuscator:** decodes selected layers of Base64, URL encoding, Unicode escapes, and common HTML entities. It only transforms text; it never executes or evaluates pasted code. Decoding is heuristic and does not cover every encoding or obfuscation scheme.
- **HTTP Inspector:** includes an offline status-code reference and common-header guide, parses pasted raw headers, and provides basic security-header guidance. It is not a live HTTP client or a complete security audit.

No AI features, authentication, cloud sync, external APIs, or paid integrations are included.
