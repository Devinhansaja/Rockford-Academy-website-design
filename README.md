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

## Vercel preview (design only)

Vercel builds a **static preview** of the public pages (`vercel.json` → `rockford/scripts/export-static.js`).
Forms do not work there, because they need a server with a disk for the database and CVs.
The admin is included as a **clickable demo** at `/admin/login` (the demo login is pre-filled): it shows the real
admin screens with sample vacancies and flyers, but nothing can be saved. The sample content is added only to the
throwaway database used for the export (sample files live in `rockford/scripts/demo-assets/`).
For the live site, run the Node server on a VPS or Node host. See [`rockford/docs/DEPLOY.md`](rockford/docs/DEPLOY.md).

## Tests

```bash
cd rockford
npm test
```
