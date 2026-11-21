import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import prefixer from 'postcss-prefix-selector';

// Dev server binds to loopback only: this app is designed for an air-gapped host.
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        prefixer({
          prefix: '.nx-root',
          includeFiles: [/src\/network\/styles/],
          transform(prefix, selector, prefixedSelector) {
            if (
              selector === ':root' ||
              selector === 'html, body' ||
              selector === 'body' ||
              selector === 'html' ||
              selector === '#root'
            ) {
              return prefix;
            }
            if (selector.startsWith('*, *::before')) {
              return `${prefix}, ${prefix} *, ${prefix} *::before, ${prefix} *::after`;
            }
            return prefixedSelector;
          },
        }),
      ],
    },
  },
  // ignore the backend folder when it is nested in this project (its SQLite/WAL files change constantly)
  server: { host: '127.0.0.1', port: 5173, watch: { ignored: ['**/.venv/**'] } },
  preview: { host: '127.0.0.1', port: 4173 },
});
