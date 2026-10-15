import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5173 },
  resolve: { alias: { 'three/examples/jsm': 'three/examples/jsm', 'three/addons': 'three/examples/jsm' } },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        customer: fileURLToPath(new URL('./customer.html', import.meta.url))
      }
    }
  }
});
