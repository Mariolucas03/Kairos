import React, { createContext, useContext, useState, useEffect } from 'react';

const WorkoutContext = createContext();

export function WorkoutProvider({ children }) {
    const [activeRoutine, setActiveRoutine] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);

    // Al cargar la app, miramos si había un entreno activo
    useEffect(() => {
        const keys = Object.keys(localStorage);
        const activeKey = keys.find(k => k.startsWith('workout_active_'));

        if (activeKey) {
            try {
                const saved = JSON.parse(localStorage.getItem(activeKey));
                if (saved && saved.routineId) {
                    setActiveRoutine({
                        _id: saved.routineId,
                        name: saved.routineName || 'Entrenamiento en curso',
                        exercises: saved.exercises || []
                    });
                    setIsMinimized(true); // Restaurar minimizado
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