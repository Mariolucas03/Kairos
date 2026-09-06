/**
 * LAS SUPERSERIES.
 *
 * ⚠️ ANTES NO HACÍAN NADA.
 *
 * En crear rutina se le pone la misma letra a dos ejercicios para hacerlos
 * seguidos sin descanso. La letra se guardaba, viajaba al servidor y se escribía
 * en el registro del entreno... y ahí se acababa. Durante el entreno no agrupaba
 * nada, no se veía por ningún lado, y entre un ejercicio y el otro saltaba el
 * descanso completo — que es exactamente lo contrario de lo que significa una
 * superserie.
 *
 * ⚠️ POR QUÉ ESTÁ AQUÍ Y NO DENTRO DE ActiveWorkout.
 *
 * Vivía dentro del componente, que son 1.182 líneas, y desde ahí no se puede
 * probar: haría falta montar un entreno entero en la pantalla para comprobar
 * una regla que es aritmética pura. Y falta hacerlo, porque la primera versión
 * de `siguienteDelGrupo` estaba MAL —ver el comentario de abajo— y solo se
 * descubrió releyéndola, no ejecutándola.
 *
 * Aquí `exercises` entra por parámetro y no hay estado de React de por medio.
 */

/** La letra del grupo, normalizada. '' si el ejercicio no está en ninguno. */
export const letraDe = (ex) => (ex?.superserie || '').trim().toUpperCase();

/**
 * Los índices de los ejercicios que comparten letra con el de `exIdx`,
 * incluido él mismo. Lista vacía si no hay superserie.
 */
export const grupoDe = (exercises, exIdx) => {
    const letra = letraDe(exercises?.[exIdx]);
    if (!letra) return [];

    const miembros = exercises
        .map((e, i) => (letraDe(e) === letra ? i : -1))
        .filter(i => i >= 0);

    // Una letra puesta a un solo ejercicio no es una superserie: es una letra
    // suelta, y tratarla como grupo le quitaría el descanso sin motivo.
    return miembros.length > 1 ? miembros : [];
};

/** Cuántas series lleva completadas un ejercicio. */
const hechas = (exercises, i) =>
    (exercises[i]?.setsData || []).filter(s => s.completed).length;

/**
 * A quién le toca ahora dentro del grupo, o null si la vuelta está cerrada
 * (y entonces toca descansar).
 *
 * ⚠️ NO es "¿queda algo por hacer?".
 *
 * Esa fue la primera versión y estaba mal: mientras no terminas la ÚLTIMA
 * vuelta siempre queda algo por hacer en el grupo, así que no se descansaba
 * nunca. Una superserie es un círculo —A, B, A, B— y el descanso llega al
 * cerrar cada vuelta, no al acabarlas todas.
 *
 * Lo que hay que mirar es quién va POR DETRÁS en esta vuelta: si otro del grupo
 * lleva menos series hechas que tú, le toca a él y se sigue sin descansar. Si
 * todos van iguales o por delante, la vuelta está cerrada.
 *
 * Se busca DESPUÉS del actual y se da la vuelta al llegar al final, porque el
 * círculo no empieza necesariamente en el primero del grupo.
 *
 * @param exercises  los ejercicios del entreno
 * @param exIdx      el ejercicio cuya serie se acaba de marcar
 * @param yaContada  true si `setsData` YA incluye la serie recién marcada.
 *                   Desde el componente es false: React todavía no ha aplicado
 *                   el cambio de estado cuando esto corre, así que se suma a
 *                   mano.
 */
export const siguienteDelGrupo = (exercises, exIdx, { yaContada = false } = {}) => {
    const grupo = grupoDe(exercises, exIdx);
    if (grupo.length === 0) return null;

    const misHechas = hechas(exercises, exIdx) + (yaContada ? 0 : 1);
    const desde = grupo.indexOf(exIdx);

    for (let k = 1; k < grupo.length; k++) {
        const i = grupo[(desde + k) % grupo.length];
        const vaPorDetras = hechas(exercises, i) < misHechas;
        const leQuedaAlgo = (exercises[i].setsData || []).some(s => !s.completed);
        if (vaPorDetras && leQuedaAlgo) return i;
    }
    return null;
};
