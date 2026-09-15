import { mutate } from 'swr';

/**
 * INVALIDAR EL DIA DE HOY.
 *
 * El Home pinta `/daily`: misiones hechas, comida, entrenos, pasos... Y todo
 * eso se escribe desde OTRAS pantallas (Misiones, Comida, Gym), que actualizan
 * su propia cache y no la del dia. Al volver al Home, SWR revalida al montar,
 * pero dentro del intervalo de deduplicacion se queda con lo que tenia: se
 * completaba una mision, se volvia al Home y el widget seguia en "2 de 3".
 *
 * Quien escriba algo que cambia el dia llama a esto, y el Home se entera.
 */
export const invalidarDiario = () => {
    try { mutate('/daily'); } catch { /* sin cache no hay nada que invalidar */ }
};
