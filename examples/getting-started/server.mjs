// Zero-dependency static server for the demo app. Serves ./app so the example
// is fully hermetic — no external network, no npm dependencies beyond Playwright
// itself. Playwright's `webServer` config starts and stops it automatically.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'app');
const port = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const requested = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(appDir, path.normalize(requested));
  // Never serve outside the app directory.
  if (!filePath.startsWith(appDir)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(port, () => {
  console.log(`demo app listening on http://localhost:${port}`);
});
