/**
 * LAS CUENTAS DE LA PESTAÑA DE ESTADISTICAS.
 *
 * Viven aquí y no dentro del componente por lo de siempre: son aritmética, se
 * pueden equivocar en silencio, y desde dentro de un `.jsx` con `useSWR` no hay
 * forma de probarlas sin montar media pantalla.
 */

/**
 * EL 1RM ESTIMADO: cuánto moverías a una sola repetición.
 *
 * Es el número que mira todo el mundo en un gimnasio y que Kairos no enseñaba
 * por ningún lado. Lo interesante no es el dato suelto: es que 80 kg × 10 y
 * 90 kg × 6 salen casi iguales, así que una gráfica de esto distingue "levanto
 * más" de "he cambiado repeticiones por peso", que a ojo se confunden.
 *
 * Fórmula de Epley: peso × (1 + reps/30). Se usa esta y no otra porque es la
 * que da la vuelta bien —las tablas de gimnasio de toda la vida salen de aquí—
 * y porque no necesita más datos que los que ya se guardan.
 *
 * ⚠️ TRES CASOS EN LOS QUE NO SE ESTIMA NADA.
 *
 *   - Sin peso (0 kg): los de peso corporal no tienen 1RM, y multiplicar por
 *     cero daría una gráfica plana en el suelo que parece un fallo.
 *   - Una sola repetición: eso YA es tu 1RM, no hay nada que estimar. Aplicar
 *     la fórmula lo inflaría un 3% sin ningún motivo.
 *   - Más de 12 repeticiones: a partir de ahí Epley se dispara y empieza a
 *     inventar. Una serie de 20 daría 1,67 veces el peso, que no se parece a lo
 *     que levantarías de verdad. Antes que enseñar un número falso, no se
 *     enseña ninguno.
 */
const TOPE_DE_REPS_FIABLE = 12;

export const unaRepeticionMaxima = (peso, reps) => {
    const kg = Number(peso) || 0;
    const r = Number(reps) || 0;

    if (kg <= 0 || r <= 0) return null;
    if (r === 1) return kg;
    if (r > TOPE_DE_REPS_FIABLE) return null;

    return Math.round(kg * (1 + r / 30));
};

/** Añade el 1RM a cada punto de la gráfica de progreso. */
export const conUnaRepeticion = (puntos = []) =>
    puntos.map(p => ({ ...p, rm1: unaRepeticionMaxima(p.bestWeight, p.bestReps) }));

/**
 * LO QUE TIENES ABANDONADO.
 *
 * Dejas de hacer un ejercicio porque un día tenías prisa, y no vuelves nunca.
 * No hay ningún momento en el que la app te lo recuerde: la lista de ejercicios
 * entrenados ya venía con la fecha de la última vez (`last`) y no la miraba
 * nadie.
 *
 * ⚠️ HACE FALTA HABERLO HECHO MAS DE UNA VEZ.
 *
 * Probar un ejercicio un día y no repetir no es abandonarlo: es haberlo
 * probado. Meter eso en la lista la llenaría de cosas que nunca fueron tuyas y
 * el aviso dejaría de significar nada.
 *
 * @param entrenados  [{ name, sessions, last }] tal cual lo manda /gym/progress
 * @param opciones.desdeDias  a partir de cuántos días cuenta como abandonado
 * @param opciones.cuantos    cuántos enseñar (los más olvidados primero)
 * @param opciones.ahora      inyectable para poder probarlo
 */
export const loQueTienesAbandonado = (entrenados = [], {
    desdeDias = 21,
    cuantos = 4,
    ahora = Date.now()
} = {}) => {
    const DIA = 86400000;

    return (entrenados || [])
        .filter(e => e?.last && (e.sessions || 0) > 1)
        .map(e => ({
            name: e.name,
            sessions: e.sessions,
            dias: Math.floor((ahora - new Date(e.last).getTime()) / DIA)
        }))
        .filter(e => Number.isFinite(e.dias) && e.dias >= desdeDias)
        .sort((a, b) => b.dias - a.dias)
        .slice(0, cuantos);
};

/**
 * "hace 3 semanas", "hace 2 meses".
 *
 * En semanas y no en días porque a partir de tres semanas "hace 47 días" obliga
 * a dividir mentalmente, y lo que quieres saber es si es mucho o poco.
 */
export const desdeHace = (dias) => {
    // ⚠️ Se REDONDEA, no se trunca.
    //
    // Truncando, 51 dias salian como "hace un mes" —y 59 tambien—, que se queda
    // muy corto justo donde el dato importa: la diferencia entre dejar algo hace
    // un mes y hace dos es la diferencia entre retomarlo y volver a empezar.
    // 30,44 es el mes medio; con el, 51 dias son dos meses y 45 son uno.
    if (dias >= 365) {
        const años = Math.round(dias / 365);
        return años === 1 ? 'hace un año' : `hace ${años} años`;
    }
    if (dias >= 30) {
        const meses = Math.round(dias / 30.44);
        return meses === 1 ? 'hace un mes' : `hace ${meses} meses`;
    }
    const semanas = Math.floor(dias / 7);
    return semanas === 1 ? 'hace 1 semana' : `hace ${semanas} semanas`;
};
