/**
 * QUÉ SIGNIFICA CADA TIPO DE SERIE, Y QUÉ TIENE SENTIDO PREGUNTAR.
 *
 * Una serie se puede marcar como normal, calentamiento, al fallo o drop. Eso
 * ya cambiaba cómo se pinta la fila, pero no cambiaba nada más: durante el
 * descanso se preguntaba siempre lo mismo, "¿cuántas más podías hacer?", y se
 * comparaba siempre contra el objetivo del día.
 *
 * Las dos cosas están mal según el tipo:
 *
 *   - En un CALENTAMIENTO la pregunta no tiene respuesta útil. Un
 *     calentamiento está lejos del fallo a propósito; contestar "4+" cada vez
 *     es ruido, y marcarlo como "no cumpliste el objetivo" es peor, porque no
 *     había objetivo que cumplir.
 *
 *   - Una serie AL FALLO ya dice cuántas quedaban: ninguna. Preguntarlo es
 *     pedir dos veces el mismo dato, y deja la puerta a que se guarde algo
 *     que se contradice con el tipo marcado.
 *
 *   - Un DROP se lleva hasta donde se puede, así que la pregunta es la misma
 *     pero referida al final del drop, no a la serie entera.
 */

export const NOMBRE_TIPO = {
    N: 'Serie',
    W: 'Calentamiento',
    F: 'Serie al fallo',
    D: 'Drop'
};

/**
 * Cómo preguntar el esfuerzo (RIR) de una serie de este tipo.
 *
 * @returns {{preguntar: boolean, pregunta?: string, nota?: string, valorFijo?: number}}
 *   `preguntar` false significa que no se enseña la fila de botones.
 *   `valorFijo` es el RIR que se da por hecho sin preguntar.
 */
export const esfuerzoSegunTipo = (tipo) => {
    switch (tipo) {
        case 'W':
            return {
                preguntar: false,
                nota: 'Calentamiento: aquí no se mide el esfuerzo.'
            };
        case 'F':
            return {
                preguntar: false,
                valorFijo: 0,
                nota: 'Al fallo: no quedaba ninguna.'
            };
        case 'D':
            return {
                preguntar: true,
                pregunta: '¿Cuántas más al acabar el drop?'
            };
        default:
            return {
                preguntar: true,
                pregunta: '¿Cuántas más podías hacer?'
            };
    }
};

/**
 * ¿Esta serie se compara con el objetivo del día?
 *
 * El calentamiento no: enseñar "✗ no llegaste" en una serie que no pretendía
 * llegar es decirle a alguien que ha fallado algo que ha hecho bien.
 */
export const cuentaParaElObjetivo = (tipo) => tipo !== 'W';

/**
 * Cómo se anuncia la siguiente serie durante el descanso.
 *
 * @param {string} tipo    tipo de la serie que viene
 * @param {string} etiqueta  su número tal como se pinta en la fila
 * @param {string} meta    el objetivo, ya formateado (puede ir vacío)
 */
export const anuncioDeLaSiguiente = (tipo, etiqueta, meta) => {
    if (tipo === 'W') return 'Ahora: calentamiento';
    if (tipo === 'D') return `Ahora: drop ${etiqueta}`;
    if (tipo === 'F') return `Ahora: serie ${etiqueta}, al fallo`;
    return meta ? `Ahora: serie ${etiqueta} · ${meta}` : `Ahora: serie ${etiqueta}`;
};
