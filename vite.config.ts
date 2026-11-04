import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://arnav-menon.github.io/jobagent-web/
export default defineConfig({
  plugins: [react()],
  base: '/jobagent-web/',
})
