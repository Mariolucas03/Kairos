import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAuthStore = create(
    persist(
        (set) => ({
            user: null,
            isUiHidden: false,

            // Acciones para modificar el estado
            setUser: (userData) => set({ user: userData }),
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