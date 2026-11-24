import { defineConfig } from 'vite';

// two pages: the game, and the map designer
export default defineConfig({
  build: { rollupOptions: { input: { main: 'index.html', editor: 'editor.html' } } },
});
