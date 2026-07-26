/**
 * Capas de apilado (z-index) de la app.
 *
 * Había 9 valores distintos repartidos por el código (60, 80, 90, 100, 110, 200,
 * 250, 9999, 10000) elegidos a ojo, y por eso algunos modales quedaban por debajo
 * de la cabecera o del menú inferior. Estas son las únicas capas válidas.
 */
export const Z = {
    header: 50,     // Cabecera y menú inferior fijos
    overlay: 100,   // Paneles a pantalla completa (entreno activo, pantalla de muerte)
    modal: 200,     // Modales normales
    confirm: 300,   // Confirmaciones (deben quedar por encima del modal que las abre)
    toast: 400      // Avisos: siempre lo más arriba
};
