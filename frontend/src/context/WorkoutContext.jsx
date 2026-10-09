import React, { createContext, useContext, useState, useEffect } from 'react';

const WorkoutContext = createContext();

export function WorkoutProvider({ children }) {
    const [activeRoutine, setActiveRoutine] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);

    // Recuperar sesión al cargar la página por si se refresca
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
                        exercises: saved.exercises || [],
                        // Si se empezo en modo moldeable, al recuperar la
                        // sesion tiene que seguir siendolo: si no, los
                        // cambios hechos antes de recargar no se guardarian.
                        moldeable: !!saved.moldeable
                    });
                    // Si recuperamos sesión, la mostramos minimizada por defecto para no invadir
                    setIsMinimized(true);
                }
            } catch (e) {
                console.error("Error recuperando sesión", e);
            }
        }
    }, []);

    /**
     * Empezar una rutina.
     *
     * `moldeable`: la rutina se puede cambiar mientras la haces (añadir,
     * quitar y cambiar ejercicios) y al terminar se guarda como la dejaste.
     * Sin el, la rutina es un guion fijo y los cambios valen solo para hoy.
     */
    const startWorkout = (routine, { moldeable = false } = {}) => {
        setActiveRoutine({ ...routine, moldeable });
        setIsMinimized(false); // Al empezar, pantalla completa
    };

    const minimizeWorkout = () => setIsMinimized(true);
    const maximizeWorkout = () => setIsMinimized(false);

    const endWorkout = () => {
        setActiveRoutine(null);
        setIsMinimized(false);
        // Limpieza de localStorage
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