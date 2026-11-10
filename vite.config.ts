import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative paths, so the build works at any address (GitHub Pages serves
  // the game from /deions-crib/, not from the root of the site).
  base: './',
  plugins: [
    // Makes the game installable to a phone's home screen and playable offline.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,png,woff,woff2}'] },
      manifest: {
        name: "Deion's Crib",
        short_name: "Deion's Crib",
        description: 'Cribbage against the computer, with Game Boy-era looks.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        background_color: '#0c2a30',
        theme_color: '#0c2a30',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
