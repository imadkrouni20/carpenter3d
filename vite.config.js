import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Capacitor يحدد المسار عبر متغير بيئة
const isCap = process.env.CAP_BUILD === '1';

export default defineConfig({
  base: isCap ? './' : '/carpenter3d/',
  server: { host: '0.0.0.0', port: 5173 },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        customer: fileURLToPath(new URL('./customer.html', import.meta.url))
      }
    }
  }
});
