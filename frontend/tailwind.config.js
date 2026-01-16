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