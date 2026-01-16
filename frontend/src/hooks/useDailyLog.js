import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function useDailyLog(user) {
    const [dailyData, setDailyData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 1. Cargar Datos
    const fetchDailyData = useCallback(async () => {
        if (!user) return;

        // --- CORRECCIÓN AQUÍ ---
        // Solo mostramos 'loading' si NO tenemos datos previos.
        // Si ya hay datos, esto ocurre en "segundo plano" sin parpadeos.
        setDailyData(prevData => {
            if (!prevData) setLoading(true);
            return prevData; // Mantenemos los datos viejos mientras cargan los nuevos
        });

        try {
            const res = await api.get('/daily');
            setDailyData(res.data || {});
        } catch (err) {
            console.error("Error cargando diario:", err);
            setError(err);
            // Si falla y no teníamos datos, ponemos objeto vacío para quitar el loading
            setDailyData(prev => prev || {});
        } finally {
            setLoading(false);
        }
    }, [user]); // Al cambiar el user, se ejecuta, pero gracias al IF de arriba no parpadea

    // Cargar al montar o cambiar usuario
    useEffect(() => {
        fetchDailyData();
    }, [fetchDailyData]);

    // 2. Actualizar un Widget específico
    const updateWidget = async (type, value) => {
        setDailyData(prev => ({ ...prev, [type]: value }));
        try {
            await api.put('/daily', { type, value });
        } catch (err) {
            console.error(`Error actualizando ${type}:`, err);
        }
    };

    // 3. Cálculos Derivados (Getters)
    const getBurnedCalories = () => {
        if (!dailyData) return 0;
        const sport = dailyData.sportWorkouts?.reduce((acc, w) => acc + (w.caloriesBurned || 0), 0) || 0;
        const gym = dailyData.gymWorkouts?.reduce((acc, w) => acc + (w.caloriesBurned || 0), 0) || 0;
        return Math.round(sport + gym);
    };

    const getIntakeCalories = () => {
        return dailyData?.nutrition?.totalKcal || dailyData?.totalKcal || 0;
    };

    return {
        dailyData,
        loading,
        error,
        updateWidget,
        refreshLog: fetchDailyData,
        calculations: {
            burned: getBurnedCalories(),
            intake: getIntakeCalories()
        }
    };
}