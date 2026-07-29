import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Nom du dépôt GitHub : à adapter si le dépôt porte un autre nom que celui-ci
export default defineConfig({
  plugins: [react()],
  base: './',
});
