/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // --- BASE (ESTRUCTURA) ---
                black: '#000000', // Negro Puro
                'dark-bg': '#000000', // Alias para fondo

                // Superficies (Tarjetas, Modales, Barras)
                'dark-card': '#09090b', // Zinc 950 (Casi negro, para elevar)

                // Bordes y líneas divisorias
                'dark-border': '#27272a', // Zinc 800 (Sutil)

                // --- TEXTOS ---
                'silver-100': '#e4e4e7', // Principal (Blanco suave)
                'silver-400': '#a1a1aa', // Secundario (Gris medio)
                'silver-600': '#52525b', // Inactivo/Placeholder

                // --- ACENTOS (RPG & INTERACCIÓN) ---
                // DORADO (Marca principal, XP, Dinero)
                gold: {
                    400: '#facc15', // Brillo / Hover
                    500: '#eab308', // Base
                    600: '#ca8a04', // Sombra / Borde
                    900: '#422006', // Fondos muy suaves de dorado
                },

                // ROJO (Salud, Peligro)
                danger: {
                    500: '#ef4444',
                    900: '#450a0a',
                },

                // VERDE (Éxito, Stamina)
                success: {
                    500: '#22c55e',
                    900: '#052e16',
                },

                // AZUL (Info, Mana)
                info: {
                    500: '#3b82f6',
                    900: '#172554',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },

            /**
             * LA ESCALA DE ESQUINAS.
             *
             * ⚠️ HABIA DIECISEIS RADIOS DISTINTOS: 2, 3, 8, 12, 13, 14, 16, 18,
             * 20, 22, 24, 26, 28, 30, 32 y 40 px.
             *
             * Nadie eligió dieciséis: se fueron escribiendo a mano pantalla por
             * pantalla, y el resultado es que dos tarjetas que se ven juntas
             * tienen esquinas distintas. Nadie sabe decir POR QUE una interfaz
             * le parece descuidada, pero esto es de las cosas que lo provocan.
             *
             * Cuatro pasos, por lo que ES cada cosa y no por su tamaño:
             */
            // ⚠️ Se REDEFINEN los nombres de Tailwind en vez de añadir otros.
            //
            // Ya había 696 radios escritos como `rounded-xl`, `rounded-2xl`...
            // Meter nombres nuevos al lado dejaría DOS vocabularios para lo
            // mismo, que es el problema que esto viene a resolver. Cambiando los
            // valores, los 696 se colocan solos en la escala.
            borderRadius: {
                // Pastillas, insignias, botones de icono pequeños
                lg: '10px',
                // Lo que se pulsa o se escribe: botones, casillas
                xl: '14px',
                // Una tarjeta dentro de una lista
                '2xl': '20px',
                // El bloque que agrupa tarjetas, y los modales
                '3xl': '28px',
                // Hojas a ancho completo: el resumen del entreno, la ficha
                '4xl': '36px'
            },

            /**
             * EL TEXTO PEQUEÑO, EN TRES PASOS.
             *
             * Habia SIETE tamaños por debajo de 14px: 7, 8, 9, 10, 11, 12 y 13.
             * Cuando casi todo mide entre 9 y 11 px, la diferencia no se lee
             * como jerarquía, se lee como descuido — y a 7 px, sobre un móvil y
             * en negro, directamente no se lee.
             */
            fontSize: {
                // Etiquetas en mayúsculas: "SERIES", "VOLUMEN"
                micro: ['10px', { lineHeight: '1.3', letterSpacing: '0.08em' }],
                // Texto secundario: explicaciones, pies de dato
                mini: ['11px', { lineHeight: '1.45' }],
                // Texto normal de tarjeta
                base2: ['13px', { lineHeight: '1.5' }]
            },
            backgroundImage: {
                // Degradados sutiles para dar volumen sin ensuciar
                'gradient-gold': 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)',
                'gradient-dark': 'linear-gradient(to bottom, #09090b 0%, #000000 100%)',
            },
            boxShadow: {
                'glow-gold': '0 0 15px rgba(234, 179, 8, 0.2)',
                'glow-red': '0 0 15px rgba(239, 68, 68, 0.2)',
            }
        },
    },
    plugins: [],
}