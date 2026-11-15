import { defineConfig } from 'vite';
import content from './src/content.js';
import { renderApp, renderHead } from './src/template.js';

// The page markup is generated from src/content.js at build time.
const signalTemplate = () => ({
  name: 'signal-template',
  transformIndexHtml(html) {
    return html.replace('<!--head-->', renderHead(content)).replace('<!--app-->', renderApp(content));
  },
});

export default defineConfig({
  // Relative base works on GitHub Pages project sites (/Portfolio/) and anywhere else.
  base: './',
  plugins: [signalTemplate()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
