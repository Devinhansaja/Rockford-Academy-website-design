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
The admin is included as a **clickable demo** at `/admin/login` (the demo login is pre-filled). It works without a server: vacancies and flyers added, edited or deleted in the demo admin (including image, PDF and Word flyers) are kept in the visitor's own browser, and the home page, Careers page and vacancy pages redraw from them, so a client can see a change appear on the site. Nothing is sent anywhere or shared between visitors, and the demo has a Reset button. The sample content is added only to the throwaway database used for the export (sample files and the demo script live in `rockford/scripts/demo-assets/`).

## Tests

```bash
cd rockford
npm test
```
