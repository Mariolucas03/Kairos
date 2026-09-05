import { useSyncExternalStore, useEffect, useState, useCallback, useRef } from 'react';
import { suscribirse, resumenCola, vaciarCola } from '../utils/colaEnvios';

/**
 * LO QUE ESTÁ ESPERANDO A SUBIR.
 *
 * ⚠️ LA COLA FUNCIONABA, PERO NO SE VEÍA.
 *
 * Guardar un entreno sin cobertura ya no daba "Error al guardar": se apuntaba
 * en el móvil y se subía solo al volver la red. El problema es que eso pasaba
 * ENTERAMENTE a oscuras. Salía un aviso de tres segundos y después no quedaba
 * ni rastro: si cerrabas la app con dos cosas esperando, al abrirla al día
 * siguiente nada te decía que seguían ahí. Y cuando por fin subían, tampoco te
 * enterabas — la confirmación era un `console.log`.
 *
 * O sea que quien peor lo pasaba era el que ya había sufrido el problema: había
 * guardado un entreno en un sótano y no tenía forma de saber si estaba a salvo.
 *
 * `useSyncExternalStore` porque la cola no es estado de React: la tocan
 * `ActiveWorkout`, el buscador de comida, las misiones y el vigilante que se
 * engancha en `main.jsx`, todos por su cuenta. Esta es la manera de que React
 * mire algo de fuera sin quedarse con una copia vieja.
 */
export function useColaPendiente() {
    const resumen = useSyncExternalStore(
        suscribirse,
        resumenCola,
        // En el servidor no hay `localStorage`. Aquí no se renderiza en
        // servidor, pero la firma lo pide y devolver el vacío es lo correcto.
        () => ({ total: 0, etiquetas: [] })
    );

    // ¿Hay red? Cambia el mensaje: "sin conexión" y "no ha podido subir" son
    // dos problemas distintos, y el segundo no se arregla saliendo a la calle.
    const [enLinea, setEnLinea] = useState(
        () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
    );

    useEffect(() => {
        const arriba = () => setEnLinea(true);
        const abajo = () => setEnLinea(false);
        window.addEventListener('online', arriba);
        window.addEventListener('offline', abajo);
        return () => {
            window.removeEventListener('online', arriba);
            window.removeEventListener('offline', abajo);
        };
    }, []);

    // ⚠️ EL AVISO DE "YA ESTÁ SUBIDO" ES LA MITAD QUE FALTABA.
    //
    // Enseñar que hay cosas esperando sin enseñar nunca que han llegado deja al
    // usuario igual de a ciegas: se le cambia una duda por otra. Se guarda
    // cuántas había justo antes de que la cola se quedase a cero.
    const anterior = useRef(resumen.total);
    const [subidas, setSubidas] = useState(0);

    useEffect(() => {
        if (anterior.current > 0 && resumen.total === 0) {
            setSubidas(anterior.current);
            const id = setTimeout(() => setSubidas(0), 4000);
            anterior.current = 0;
            return () => clearTimeout(id);
        }
        anterior.current = resumen.total;
    }, [resumen.total]);

    const [reintentando, setReintentando] = useState(false);

    const reintentar = useCallback(async () => {
        setReintentando(true);
        try {
            await vaciarCola();
        } finally {
            setReintentando(false);
        }
    }, []);

    return { resumen, enLinea, subidas, reintentando, reintentar };
}

export default useColaPendiente;
