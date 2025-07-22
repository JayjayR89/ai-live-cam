import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300, // 5 minutes
              },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\./,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 86400, // 1 day
              },
            },
          },
        ],
      },
      manifest: {
        name: 'AI Live Cam - Real-time Object Detection',
        short_name: 'AI Live Cam',
        description: 'Real-time camera AI with object detection and voice synthesis',
        theme_color: '#3B82F6',
        background_color: '#1F2937',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '48x48',
            type: 'image/x-icon'
          },
          {
            src: '/placeholder.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/placeholder.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        categories: ['photography', 'utilities', 'productivity'],
        shortcuts: [
          {
            name: 'Quick Capture',
            short_name: 'Capture',
            description: 'Take a quick photo with AI analysis',
            url: '/?action=capture',
            icons: [{ src: '/favicon.ico', sizes: '48x48' }]
          },
          {
            name: 'Object Detection',
            short_name: 'Detect',
            description: 'Real-time object detection mode',
            url: '/?action=detect',
            icons: [{ src: '/favicon.ico', sizes: '48x48' }]
          }
        ]
      },
      devOptions: {
        enabled: mode === 'development'
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'tensorflow': ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-toast', '@radix-ui/react-tabs'],
          'utils': ['date-fns', 'clsx', 'tailwind-merge']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd']
  }
}));
