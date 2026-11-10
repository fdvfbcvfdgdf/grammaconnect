// GrammaConnect web server: serves the website in /public and the REST API under /api.
// Community Service Project (CSP) Portal.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApi } = require('./src/api');
const { HttpError, sendJson } = require('./src/http');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function serveStatic(pathname, res) {
  let requested = pathname === '/' ? '/index.html' : pathname;

  // Clean URLs support: /login -> /login.html, /about -> /about.html, etc.
  if (!path.extname(requested)) {
    const htmlCandidate = requested + '.html';
    const candidatePath = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(htmlCandidate)));
    if (candidatePath.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(candidatePath)) {
      requested = htmlCandidate;
    }
  }

  const file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(requested)));

  // Block path traversal such as /../server.js
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Page not found');
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(url.pathname, res);
  } catch (err) {
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
    console.error(err);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
});

module.exports = server;

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`GrammaConnect running at http://localhost:${PORT}`);
    if (!process.env.GRAMMA_SECRET) {
      console.log('Tip: set GRAMMA_SECRET to a long random string before deploying.');
    }
  });
}
