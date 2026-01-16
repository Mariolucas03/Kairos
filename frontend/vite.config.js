import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    // Esto ayuda a que Vite encuentre los archivos en Vercel
    base: '/',
})