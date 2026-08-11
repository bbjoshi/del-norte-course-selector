import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env file so VITE_* vars are available at config time
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      // Support both VITE_ prefix (standard) and REACT_APP_ prefix (legacy Render env vars)
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        env.VITE_FIREBASE_API_KEY || env.REACT_APP_FIREBASE_API_KEY
      ),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        env.VITE_FIREBASE_AUTH_DOMAIN || env.REACT_APP_FIREBASE_AUTH_DOMAIN
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        env.VITE_FIREBASE_PROJECT_ID || env.REACT_APP_FIREBASE_PROJECT_ID
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        env.VITE_FIREBASE_STORAGE_BUCKET || env.REACT_APP_FIREBASE_STORAGE_BUCKET
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        env.VITE_FIREBASE_APP_ID || env.REACT_APP_FIREBASE_APP_ID
      ),
      'import.meta.env.VITE_USE_FIREBASE_EMULATOR': JSON.stringify(
        env.VITE_USE_FIREBASE_EMULATOR || 'false'
      ),
    },
    plugins: [
      react(),
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:3003',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'build',
      sourcemap: false,
      commonjsOptions: {
        include: [/node_modules/],
        exclude: [/firebase/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: [],
        onwarn(warning, warn) {
          // Suppress warnings for @babel/runtime and Firebase
          if (warning.code === 'UNRESOLVED_IMPORT' &&
              (warning.message.includes('@babel/runtime') || warning.message.includes('firebase'))) {
            return
          }
          // Suppress circular dependency warnings for Firebase
          if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message.includes('firebase')) {
            return
          }
          // Suppress missing export warnings for Firebase
          if (warning.code === 'MISSING_EXPORT' && warning.ids && warning.ids.some(id => id.includes('firebase'))) {
            return
          }
          warn(warning)
        },
      },
    },
    optimizeDeps: {
      include: [
        '@chakra-ui/react',
        '@emotion/react',
        '@emotion/styled',
        '@emotion/utils',
        'framer-motion',
      ],
      exclude: ['firebase', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
    },
  }
})
