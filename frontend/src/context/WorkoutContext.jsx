import React, { createContext, useContext, useState, useEffect } from 'react';

const WorkoutContext = createContext();

export function WorkoutProvider({ children }) {
    const [activeRoutine, setActiveRoutine] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);

    // Al cargar la app, miramos si había un entreno activo en localStorage
    useEffect(() => {
        // Buscamos cualquier clave que empiece por 'workout_active_'
        const keys = Object.keys(localStorage);
        const activeKey = keys.find(k => k.startsWith('workout_active_'));

        if (activeKey) {
            try {
                const saved = JSON.parse(localStorage.getItem(activeKey));
                // Restauramos la sesión minimizada por defecto para no molestar al entrar
                if (saved && saved.routineId) {
                    // Necesitamos reconstruir un objeto rutina mínimo para que arranque
                    setActiveRoutine({
                        _id: saved.routineId,
                        name: saved.routineName || 'Entrenamiento en curso',
                        exercises: saved.exercises || []
                    });
                    setIsMinimized(true);
                }
            } catch (e) {
                console.error("Error recuperando sesión", e);
            }
        }
    }, []);

    const startWorkout = (routine) => {
        setActiveRoutine(routine);
        setIsMinimized(false);
    };

    const minimizeWorkout = () => setIsMinimized(true);
    const maximizeWorkout = () => setIsMinimized(false);

    const endWorkout = () => {
        setActiveRoutine(null);
        setIsMinimized(false);
        // Limpieza de claves (se hace también en ActiveWorkout, pero por seguridad)
        const keys = Object.keys(localStorage);
        keys.forEach(k => {
            if (k.startsWith('workout_active_')) localStorage.removeItem(k);
        });
    };

    return (
        <WorkoutContext.Provider value={{
            activeRoutine,
            isMinimized,
            startWorkout,
            minimizeWorkout,
            maximizeWorkout,
            endWorkout
        }}>
            {children}
        </WorkoutContext.Provider>
    );
}

export const useWorkout = () => useContext(WorkoutContext);