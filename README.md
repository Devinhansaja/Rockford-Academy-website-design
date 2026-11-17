# Rockford Academy — website

Website and content management system for Rockford English Academy, Sri Lanka.

| Folder | What it is |
| --- | --- |
| [`rockford/`](rockford/) | The website: Node.js server, admin panel, pages, styles and tests. Start here: [`rockford/README.md`](rockford/README.md) |
| [`docs/`](docs/) | Architecture and design-system notes |
| [`site/`](site/) | Early static prototype and the three design concepts (A Bold, B Cinematic, C Bento) |

## Run it locally

Requires Node.js 22.13 or newer. No packages to install.

```bash
cd rockford
npm start
```

Then open http://localhost:3000. Create the first admin account with `npm run create-admin`.

## Tests

```bash
cd rockford
npm test
```
