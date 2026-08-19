import { create } from 'zustand';

/**
 * ¿Está el servidor tardando en responder?
 *
 * El backend vive en el plan gratuito de Render: se duerme a los ~15 minutos de
 * inactividad y tarda entre 30 y 50 segundos en despertar. Durante esa espera la
 * app pintaba un "Cargando..." indistinguible de una app rota, y el usuario se
 * iba pensando que fallaba.
 *
 * Esto NO acelera nada —el arranque en frío se arregla con un cron externo que
 * mantenga el servidor despierto— pero convierte una espera muda en una espera
 * explicada, que es la diferencia entre "esto no va" y "esto está arrancando".
 */
export const useServidorStore = create((set) => ({
    despertando: false,
    setDespertando: (v) => set({ despertando: v })
}));
