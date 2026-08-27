import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const port = process.env.PORT || 8080;

const app = express();

// Service worker and manifest must never be cached by intermediaries so PWA
// updates propagate as soon as a new build is deployed.
app.use((req, res, next) => {
	if (req.path === '/sw.js' || req.path === '/manifest.webmanifest') {
		res.setHeader('Cache-Control', 'no-cache');
	}
	next();
});

app.use(express.static(distDir, { index: false }));

// SPA fallback: any unmatched route serves index.html so client-side routing works.
app.get('*', (_req, res) => {
	res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
	console.log(`smokeless-web listening on port ${port}`);
});
