import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')

    // PROXY DE DESARROLLO (opcional).
    // Si defines VITE_PROXY_TARGET en un .env.local, las llamadas a /api se
    // reenvían a ese backend desde el propio Vite. Sirve para probar en local
    // contra el backend desplegado sin tener que meter localhost en la lista
    // CORS de producción: el navegador habla con localhost (mismo origen) y
    // quien llama al servidor real es Vite, sin cabecera Origin.
    // Sin esa variable no se monta nada y todo funciona como siempre.
    const proxyTarget = env.VITE_PROXY_TARGET

    return {
        plugins: [react()],
        // Esto ayuda a que Vite encuentre los archivos en Vercel
        base: '/',
        server: proxyTarget ? {
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                    secure: true,
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq) => {
                            // Sin Origin, el backend lo trata como petición
                            // servidor-a-servidor y no aplica la lista blanca CORS
                            proxyReq.removeHeader('origin')
                            proxyReq.removeHeader('referer')
                        })
                    }
                }
            }
        } : undefined
    }
})
