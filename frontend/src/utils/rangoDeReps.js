/**
 * EL RANGO DE REPETICIONES QUE ESCRIBES AL MONTAR LA RUTINA.
 *
 * ⚠️ ESTABA CLAVADO EN "10-12" Y NO SE PODÍA CAMBIAR.
 *
 * Y no era un adorno olvidado: es la entrada principal de la progresión. El
 * servidor lee este campo para decidir cuándo has completado el ejercicio y
 * toca subir peso —ver services/progresionService.js—. Con "10-12" para todo,
 * la app te decía que subieras el peso muerto al llegar a 12 repeticiones, la
 * misma regla que para los curls.
 *
 * El campo existía en el modelo, el servidor lo leía, la progresión lo usaba...
 * y la pantalla de crear rutinas lo escribía siempre con el mismo valor fijo.
 *
 * ⚠️ AQUÍ NO SE INTERPRETA EL RANGO, SOLO SE LIMPIA.
 *
 * Quién es el mínimo y quién el objetivo lo decide `rangoDeReps` en el
 * servidor, y ahí se queda. Una segunda copia de esa regla en el móvil sería
 * una segunda copia que el día que cambie una se queda diciendo otra cosa —que
 * es exactamente el fallo que más veces ha aparecido en este proyecto—.
 */

/** Lo que se usa cuando no hay nada escrito. Es el de toda la vida. */
export const RANGO_POR_DEFECTO = '10-12';

/**
 * Lo que puede quedarse mientras escribes.
 *
 * Cifras y un guion. Se admite un guion suelto al final —"12-"— porque es por
 * donde pasa cualquiera al escribir "12-15", y borrárselo en mitad de la
 * palabra hace la casilla imposible de usar.
 */
export const limpiarRango = (valor) =>
    String(valor ?? '')
        .replace(/[^\d-]/g, '')
        .replace(/-+/g, '-')
        .slice(0, 7);

/**
 * Lo que se guarda al salir de la casilla.
 *
 * Aquí ya no vale quedarse a medias: un "12-" guardado llega al servidor y
 * `rangoDeReps` saca un solo número, así que lo que verías escrito no sería lo
 * que la app hace.
 */
export const cerrarRango = (valor) => {
    const limpio = limpiarRango(valor).replace(/^-+|-+$/g, '');
    return limpio || RANGO_POR_DEFECTO;
};
