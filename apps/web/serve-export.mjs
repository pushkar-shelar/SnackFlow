import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, 'out');
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

function resolveSafeFile(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const candidates = [];

  if (cleanPath === '/') {
    candidates.push('index.html');
  } else {
    const trimmed = cleanPath.replace(/^\/+/, '');
    candidates.push(trimmed);
    candidates.push(`${trimmed}.html`);
    candidates.push(path.join(trimmed, 'index.html'));
  }

  if (cleanPath.startsWith('/public/invoices/')) {
    candidates.push(path.join('public', 'invoices', 'sample.html'));
  }
  candidates.push('index.html');

  for (const rel of candidates) {
    const abs = path.resolve(OUT_DIR, rel);
    if (!abs.startsWith(OUT_DIR + path.sep) && abs !== path.join(OUT_DIR, 'index.html')) {
      continue;
    }
    try {
      const stat = fs.statSync(abs);
      if (stat.isFile()) return abs;
    } catch {
      // Try next fallback candidate
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const filePath = resolveSafeFile(req.url || '/');
  if (!filePath) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const cacheControl = filePath.includes(`${path.sep}_next${path.sep}static${path.sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=0, must-revalidate';

  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SnackFlow Web static server listening on http://0.0.0.0:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
