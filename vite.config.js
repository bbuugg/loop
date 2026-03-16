import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

function copyStaticPlugin() {
  return {
    name: 'copy-static',
    closeBundle() {
      const files = [
        'manifest.json',
        'background.js',
        'devtools.html',
        'devtools.js',
        'picker.js',
        'sandbox.html',
        'sandbox.js',
      ];
      mkdirSync('./plugin', { recursive: true });
      for (const f of files) {
        copyFileSync(`./${f}`, `./plugin/${f}`);
      }
      mkdirSync('./plugin/icons', { recursive: true });
      for (const f of readdirSync('./icons')) {
        copyFileSync(`./icons/${f}`, `./plugin/icons/${f}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyStaticPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: './plugin',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  base: '',
});
