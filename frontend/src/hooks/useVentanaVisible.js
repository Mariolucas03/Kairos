import { useEffect } from 'react';

/**
 * Mantiene dos variables CSS con el area REALMENTE visible de la pantalla.
 *
 * EL PROBLEMA
 * Los modales usan `fixed inset-0`, que cubre el viewport de MAQUETACION. Ese
 * viewport NO se encoge cuando aparece el teclado del movil: el navegador
 * simplemente dibuja el teclado encima. Resultado: un modal centrado se queda
 * centrado respecto a la pantalla entera y el teclado le tapa media caja,
 * normalmente justo el campo donde estas escribiendo.
 *
 * `window.visualViewport` si refleja lo que se ve: su `height` baja al abrirse
 * el teclado y su `offsetTop` cambia al hacer zoom o al desplazarse. Con eso se
 * alimentan --vv-alto y --vv-top, y los modales se anclan ahi en vez de a la
 * pantalla completa.
 */
export default function useVentanaVisible() {
    useEffect(() => {
        const vv = window.visualViewport;
        const raiz = document.documentElement;

        const aplicar = () => {
            const alto = vv ? vv.height : window.innerHeight;
            const top = vv ? vv.offsetTop : 0;
            raiz.style.setProperty('--vv-alto', `${alto}px`);
            raiz.style.setProperty('--vv-top', `${top}px`);
        };

        aplicar();

        if (!vv) {
            window.addEventListener('resize', aplicar);
            return () => window.removeEventListener('resize', aplicar);
        }

        vv.addEventListener('resize', aplicar);
        vv.addEventListener('scroll', aplicar);
        return () => {
            vv.removeEventListener('resize', aplicar);
            vv.removeEventListener('scroll', aplicar);
        };
    }, []);
}
