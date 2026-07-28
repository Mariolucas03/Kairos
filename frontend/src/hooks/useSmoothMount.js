/**
 * Antes este hook retrasaba 50 ms el montaje de cada página "para que la
 * transición no se congelara". En la práctica garantizaba un parpadeo de la
 * pantalla de carga en CADA cambio de sección, incluso cuando los datos ya
 * estaban en caché.
 *
 * Ya no hace falta: el `keepPreviousData` de SWR (configurado en App.jsx) hace
 * que al volver a una sección se pinten los datos anteriores al instante.
 *
 * Se mantiene la función para no tener que tocar todas las páginas que la usan.
 */
export function useSmoothMount() {
    return true;
}
