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

/**
 * CUÁNDO LLEGAS AL SIGUIENTE NÚMERO REDONDO.
 *
 * La zanahoria. Con los mismos puntos de la gráfica se traza una recta por
 * mínimos cuadrados y se dice cuánto falta para el próximo múltiplo de 10 por
 * encima de donde estás.
 *
 * ⚠️ Y SOBRE TODO: CUÁNDO NO DECIR NADA.
 *
 * Una proyección es la parte más fácil de convertir en mentira de toda la
 * pantalla, porque siempre da un número. Aquí se calla en cuatro casos:
 *
 *   - menos de cuatro sesiones: dos puntos siempre forman una recta perfecta,
 *     y esa recta no significa nada
 *   - la tendencia es plana o baja: entonces no llegas nunca, y decirlo así
 *     —"sin cambios desde junio"— es más útil que una fecha inventada
 *   - falta más de un año: a ese plazo la extrapolación es humo
 *   - todo ocurrió el mismo día: no hay tiempo transcurrido del que sacar ritmo
 */
const MINIMO_DE_SESIONES = 4;
const MAXIMO_DE_SEMANAS = 52;

export const cuandoLlegasA = (puntos = [], campo = 'rm1') => {
    const datos = (puntos || [])
        .map(p => ({ t: new Date(p.date).getTime(), v: Number(p[campo]) }))
        .filter(p => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0)
        .sort((a, b) => a.t - b.t);

    if (datos.length < MINIMO_DE_SESIONES) return null;

    // Recta por mínimos cuadrados, con el tiempo en días para que la pendiente
    // salga en "kilos por día" y se pueda leer.
    const DIA = 86400000;
    const t0 = datos[0].t;
    const xs = datos.map(p => (p.t - t0) / DIA);
    const ys = datos.map(p => p.v);
    const n = datos.length;

    const mediaX = xs.reduce((a, b) => a + b, 0) / n;
    const mediaY = ys.reduce((a, b) => a + b, 0) / n;

    let arriba = 0, abajo = 0;
    for (let i = 0; i < n; i++) {
        arriba += (xs[i] - mediaX) * (ys[i] - mediaY);
        abajo += (xs[i] - mediaX) ** 2;
    }
    if (abajo === 0) return null;   // todo el mismo día

    const porDia = arriba / abajo;
    const actual = ys[ys.length - 1];

    if (porDia <= 0) return { estancado: true, actual, desde: datos[0].t };

    // El siguiente múltiplo de 10 por encima de donde estás. Si ya estás justo
    // en uno, el objetivo es el de después: decir "llegarás a 100" cuando ya
    // haces 100 no es una meta.
    const objetivo = Math.floor(actual / 10) * 10 + 10;
    const semanas = Math.ceil((objetivo - actual) / porDia / 7);

    if (!Number.isFinite(semanas) || semanas < 1 || semanas > MAXIMO_DE_SEMANAS) return null;

    return { estancado: false, actual, objetivo, semanas };
};

/**
 * El plural de un día de la semana.
 *
 * ⚠️ CINCO DE LOS SIETE NO CAMBIAN.
 *
 * Lunes, martes, miércoles, jueves y viernes ya acaban en -s y son invariables:
 * "los viernes", no "los vierness". Solo sábado y domingo llevan -s. Salía
 * escrito mal en el aviso de la constancia, y una falta así en una frase que la
 * app repite cada semana se ve enseguida y hace que todo lo demás parezca menos
 * cuidado.
 */
export const enPlural = (dia) => {
    const d = String(dia || '').toLowerCase();
    return d.endsWith('s') ? d : `${d}s`;
};
