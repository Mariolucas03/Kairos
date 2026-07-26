import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
            setUser: (userData) => set((state) => ({
                user: typeof userData === 'function' ? userData(state.user) : userData
            })),
            setIsUiHidden: (isHidden) => set({ isUiHidden: isHidden }),
            logout: () => set({ user: null }),
        }),
        {
            name: 'kairos-auth', // Nombre de la clave en localStorage
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ user: state.user }), // Solo persistimos el usuario, no el estado de la UI
        }
    )
);