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

        // LAS PRUEBAS DEL FRONTEND.
        //
        // Van aqui y no en un vitest.config.js aparte para que hereden los
        // plugins y los alias de arriba: una prueba que compila el JSX de otra
        // forma que el build no esta probando lo que se despliega.
        //
        // `jsdom` porque casi todo lo que merece prueba aqui toca el navegador:
        // la cola de envios vive en localStorage y los componentes se pintan.
        // `globals` evita importar describe/test/expect en cada fichero, que es
        // como ya funcionan las pruebas del backend con node:test.
        test: {
            environment: 'jsdom',
            globals: true,
            // Solo lo que este junto al codigo, en src/. Sin esto Vitest se
            // mete en node_modules y en la copia vieja del proyecto.
            include: ['src/**/*.{test,prueba}.{js,jsx}'],
            restoreMocks: true
        },

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
