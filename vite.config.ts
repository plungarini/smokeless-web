import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['icons/*.png', 'fonts/*'],
			manifest: {
				id: '/',
				name: 'Smokeless',
				short_name: 'Smokeless',
				description: 'Track cigarettes, follow a quit program, and log your progress.',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				orientation: 'portrait',
				background_color: '#111116',
				theme_color: '#111116',
				icons: [
					{ src: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
					{ src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
					{ src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
					{ src: '/icons/icon-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
				runtimeCaching: [
					{
						urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
						handler: 'StaleWhileRevalidate',
						options: { cacheName: 'google-fonts-stylesheets' },
					},
					{
						urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-webfonts',
							expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
						},
					},
					// Deliberately no runtime-caching rule for firestore.googleapis.com: the
					// SDK's own persistentLocalCache (see firebase.ts) already handles
					// offline reads/writes, and letting the service worker intercept those
					// requests breaks Firestore's real-time /Listen/channel and
					// /Write/channel long-poll streams (Workbox tries to buffer/clone the
					// response to cache it, which a streaming connection can't survive) —
					// this was hanging onSnapshot() subscriptions forever on every browser.
				],
			},
			devOptions: { enabled: false },
		}),
		// Module-singleton state (AppStore, clock) doesn't survive React Fast
		// Refresh cleanly — force a full reload on any source change instead.
		{
			name: 'full-reload-on-change',
			handleHotUpdate({ server, file }) {
				if (file.includes('/src/')) {
					server.ws.send({ type: 'full-reload' });
					return [];
				}
			},
		},
	],
	server: {
		port: 5174,
	},
});
