import { useRef, useState, useCallback } from 'react';

/**
 * Envuelve una acción que escribe en el servidor para que NO pueda dispararse
 * dos veces.
 *
 * ⚠️ Por qué un `useRef` y no el estado `ocupado`:
 * `setOcupado(true)` no cambia nada hasta el siguiente render. Entre el primer
 * toque y ese render hay una ventana —pequeña en un móvil rápido, enorme en uno
 * lento o con la pantalla saturada— en la que el botón sigue habilitado y un
 * segundo toque entra igual. El ref se actualiza en el acto, así que corta de
 * verdad. El estado se devuelve sólo para pintar el botón deshabilitado.
 *
 * Uso:
 *   const [publicar, publicando] = useAccionUnica(async () => { ... });
 *   <button onClick={publicar} disabled={publicando}>Publicar</button>
 */
export default function useAccionUnica(accion) {
    const enVuelo = useRef(false);
    const [ocupado, setOcupado] = useState(false);

    const lanzar = useCallback(async (...args) => {
        if (enVuelo.current) return;
        enVuelo.current = true;
        setOcupado(true);
        try {
            return await accion(...args);
        } finally {
            enVuelo.current = false;
            setOcupado(false);
        }
    }, [accion]);

    return [lanzar, ocupado];
}
