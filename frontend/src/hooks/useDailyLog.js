import useSWR from 'swr';
import api from '../services/api';

// El "fetcher" le dice a SWR cómo ir a buscar los datos
const fetcher = (url) => api.get(url).then(res => res.data || {});

export function useDailyLog(user) {
    // 🔥 MAGIA DE SWR: 
    // Si 'user' existe, busca '/daily'. 
    // Si ya lo buscó antes, devuelve 'data' al instante desde la memoria RAM.
    const { data: dailyData, error, mutate, isLoading } = useSWR(
        user ? '/daily' : null,
        fetcher,
        {
            revalidateOnFocus: true, // Si el usuario minimiza la app y vuelve, recarga silenciosamente
            dedupingInterval: 2000,  // Evita hacer la misma petición 2 veces en menos de 2 segundos
        }
    );

    // 2. Actualizar un Widget específico de forma OPTIMISTA 🪄
    const updateWidget = async (type, value) => {
        if (!dailyData) return;

        // Clonamos los datos actuales y le aplicamos el nuevo valor
        const optimisticData = { ...dailyData, [type]: value };

        // Mutamos la caché de SWR al instante (la UI se actualiza en 0ms)
        // El 'false' le dice a SWR: "No vayas a validar al servidor todavía, confía en mí"
        mutate(optimisticData, false);

        try {
            // Mandamos el dato real al backend
            await api.put('/daily', { type, value });
            // Cuando el backend responde bien, re-validamos silenciosamente para asegurar sincronía
            mutate();
        } catch (err) {
            console.error(`Error actualizando ${type}:`, err);
            // Si falla el internet, hacemos rollback (deshacemos el cambio visual)
            mutate();
        }
    };

    // 3. Cálculos Derivados (Getters) seguros contra nulos
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
        // Si no hay data pero tampoco error, devolvemos un objeto vacío seguro para que no rompa la UI
        dailyData: dailyData || {},
        loading: isLoading,
        error,
        updateWidget,
        refreshLog: () => mutate(), // mutate fuerza a SWR a recargar los datos del servidor
        calculations: {
            burned: getBurnedCalories(),
            intake: getIntakeCalories()
        }
    };
}