import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This allows the ngrok tunnel to talk to your local dev server
    allowedHosts: true,
    // Optional: Useful if you're testing on multiple devices
    host: true, 
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    }, 
    //port: 3000
  }, 
  define: {
    global: 'window',
  },
})
