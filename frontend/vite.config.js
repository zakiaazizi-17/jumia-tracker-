import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/category-count': 'http://localhost:5000',
      '/categories': 'http://localhost:5000',
      '/category': 'http://localhost:5000',
      '/suggestions': 'http://localhost:5000',
      '/product-search': 'http://localhost:5000',
      '/products': 'http://localhost:5000',
      '/scraper-status': 'http://localhost:5000',
      '/scrape-now': 'http://localhost:5000',
    }
  }
})
