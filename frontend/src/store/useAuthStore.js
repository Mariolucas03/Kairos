import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { limpiarCacheSWR } from '../utils/swrCache';

export const useAuthStore = create(
    persist(
        (set) => ({
            user: null,
            isUiHidden: false,

            // Acciones para modificar el estado.
            // 🔥 Acepta también la forma funcional —setUser(prev => ...)— igual que
            // el setState de React. Varias pantallas (Ruleta, Rasca, Ruleta de la
            // Fortuna) ya la usaban, y al no estar soportada se guardaba la PROPIA
            // FUNCIÓN como usuario: el perfil se quedaba a cero (nivel 1, sin monedas)
            // hasta recargar.
            // ⚠️ LA SUBIDA DE NIVEL SE CAZA AQUI, NO EN CADA PANTALLA.
            //
            // El servidor devolvia `leveledUp` y en el movil NO LO MIRABA NADIE:
            // subias de nivel y no pasaba absolutamente nada. El momento mas
            // gordo del juego, en silencio.
            //
            // Engancharlo pantalla por pantalla seria repetir lo mismo en el
            // entreno, las misiones, la comida, la tienda y los nueve juegos, y
            // olvidarse en la mitad. Pero TODAS acaban llamando a `setUser`, asi
            // que basta con mirar aqui si el nivel del usuario nuevo es mayor
            // que el del viejo: un solo sitio y no se escapa ninguna via.
            subidaDeNivel: null,

            setUser: (userData) => set((state) => {
                const nuevo = typeof userData === 'function' ? userData(state.user) : userData;

                // El nivel vive en la raiz o dentro de `stats` segun de donde
                // venga la respuesta; se miran los dos.
                const nivelDe = (u) => (typeof u?.level === 'number' ? u.level : u?.stats?.level);
                const antes = nivelDe(state.user);
                const ahora = nivelDe(nuevo);

                // Solo si HABIA un nivel antes: al iniciar sesion se pasa de
                // null a nivel 12 y eso no es subir de nivel, es entrar.
                const haSubido = typeof antes === 'number' && typeof ahora === 'number' && ahora > antes;

                return {
                    user: nuevo,
                    ...(haSubido ? {
                        subidaDeNivel: {
                            de: antes,
                            a: ahora,
                            // Lo que se ha cobrado, tal cual lo dice el servidor.
                            // Si la respuesta no lo trae, se celebra igual sin
                            // cifras: mejor eso que inventarlas.
                            premio: nuevo?.ultimaSubidaDeNivel?.nivel === ahora
                                ? nuevo.ultimaSubidaDeNivel
                                : null
                        }
                    } : {})
                };
            }),

            cerrarSubidaDeNivel: () => set({ subidaDeNivel: null }),
            setIsUiHidden: (isHidden) => set({ isUiHidden: isHidden }),
            // También se tira la caché de SWR: si no, el siguiente en entrar
            // vería por un instante los datos del anterior.
            logout: () => { limpiarCacheSWR(); set({ user: null, subidaDeNivel: null }); },
        }),
        {
            name: 'kairos-auth', // Nombre de la clave en localStorage
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ user: state.user }), // Solo persistimos el usuario, no el estado de la UI
        }
    )
);