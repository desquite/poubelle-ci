// Ce fichier configure Vite et active le plugin PWA pour rendre l'app installable

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Poubelle-CI',
        short_name: 'Poubelle-CI',
        description: 'Signalement de collecte de déchets en Côte d\'Ivoire',
        theme_color: '#2e7d32',
        background_color: '#f5fdf5',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})