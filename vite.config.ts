import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), svelte(), tailwindcss()],
  server: {
    port: 3000,
    open: false
  },
  base: "./",
  build: {
    outDir: "dist",
  },
})
