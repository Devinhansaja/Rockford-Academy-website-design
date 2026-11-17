'use strict';
/*
 * Rockford Academy website.
 *   npm start            – run the site (http://127.0.0.1:3000 by default)
 *   npm run create-admin – create the first administrator account
 * See docs/INSTALL.md.
 */
process.removeAllListeners('warning'); // hide the node:sqlite "experimental" notice
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

const http = require('node:http');
const config = require('./src/config');
const app = require('./src/app');

require('./src/routes/public').register(app);
require('./src/routes/forms').register(app);
require('./src/routes/seo').register(app);
require('./src/routes/admin').register(app);
require('./src/jobs').start();

const server = http.createServer((req, res) => { app.handle(req, res); });
server.requestTimeout = 60_000;
server.headersTimeout = 20_000;
server.listen(config.port, config.host, () => {
  console.log(`Rockford Academy running at http://${config.host}:${config.port} (${config.isProd ? 'production' : 'development'})`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
