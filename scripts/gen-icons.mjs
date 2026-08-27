import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const src = './public/icons/source-applogo.png';
const outDir = './public/icons';
mkdirSync(outDir, { recursive: true });

const bg = '#0A0A0F';
// ~22% corner radius reads as a soft squircle-ish round at icon sizes
// without looking like a distinct "rounded square" sticker.
const CORNER_RATIO = 0.22;

function roundedRectMaskSvg(size, radius) {
	return Buffer.from(`<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
}

// Flat "any"-purpose icons: baked-in rounded corners, since browsers/OSes
// render these as-is (square) with no mask of their own applied.
const rounded = [
	{ size: 512, name: 'icon-512.png' },
	{ size: 192, name: 'icon-192.png' },
	{ size: 180, name: 'icon-180.png' },
	{ size: 48, name: 'favicon-48.png' },
	{ size: 32, name: 'favicon-32.png' },
	{ size: 16, name: 'favicon-16.png' },
];

// Maskable icons stay full-bleed and unrounded — the OS applies its own
// mask shape (circle, squircle, rounded-square, ...) on top of these, so
// baking in rounding here would double it up.
const maskable = [
	{ size: 192, name: 'icon-maskable-192.png' },
	{ size: 512, name: 'icon-maskable-512.png' },
];

async function run() {
	for (const { size, name } of rounded) {
		const square = await sharp(src).resize(size, size, { fit: 'cover' }).png().toBuffer();
		await sharp(square)
			.composite([{ input: roundedRectMaskSvg(size, Math.round(size * CORNER_RATIO)), blend: 'dest-in' }])
			.png()
			.toFile(`${outDir}/${name}`);
		console.log('wrote', name);
	}

	// Maskable icons need ~20% safe-area padding so platform masks don't clip the logo.
	for (const { size, name } of maskable) {
		const inner = Math.round(size * 0.6);
		const padded = await sharp(src).resize(inner, inner, { fit: 'contain' }).toBuffer();
		await sharp({
			create: { width: size, height: size, channels: 4, background: bg },
		})
			.composite([{ input: padded, gravity: 'center' }])
			.png()
			.toFile(`${outDir}/${name}`);
		console.log('wrote', name);
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
