import { useLayoutEffect, useRef, useState } from 'react';

/**
 * UNA CARTA QUE SE REPARTE Y SE VOLTEA.
 *
 * ⚠️ ANTES LAS CARTAS APARECÍAN DE LA NADA.
 *
 * Un `fade-in zoom-in` genérico: la carta se materializaba en su sitio. Una
 * carta de verdad SALE de algún sitio —el zapato, el mazo— y se desliza hasta
 * su posición, y la del crupier tapada se DA LA VUELTA cuando se destapa, no
 * se cambia por otra.
 *
 * Esto envuelve cualquier cara de carta (la de póquer, la española, la del
 * blackjack: se le pasa como `cara`) y le pone las dos cosas:
 *
 *  1. El reparto. Al montarse, mide dónde ha quedado y dónde está el zapato
 *     (`desdeRef`), se coloca en el zapato con un transform, y en el frame
 *     siguiente transiciona hasta su sitio. Es la técnica FLIP: la carta vive
 *     en el flujo normal de la página (flex, gaps, lo que sea) y aun así llega
 *     deslizándose. Sin medir nada a mano ni posicionar en absoluto.
 *
 *  2. El volteo. Cuando `oculta` pasa de true a false, gira 180° sobre su eje
 *     con `preserve-3d`: el dorso por delante hasta la mitad, la cara después.
 *
 * `retraso` escalona el reparto: la segunda carta sale después de la primera.
 * `alRepartir` y `alVoltear` son para el sonido: se llaman cuando la carta
 * arranca y cuando se da la vuelta.
 */
export default function CartaAnimada({
    cara,
    dorso,
    oculta = false,
    desdeRef = null,
    retraso = 0,
    ancho,
    alto,
    alRepartir = null,
    alVoltear = null,
    className = ''
}) {
    const ref = useRef(null);
    const [transformInicial, setTransformInicial] = useState(null);
    const [enSitio, setEnSitio] = useState(false);
    // La cara se voltea SOLO si empezó tapada: una carta que nace boca arriba
    // no tiene que girar.
    const nacioOculta = useRef(oculta);
    const [giro, setGiro] = useState(oculta ? 180 : 0);
    const avisadoVolteo = useRef(false);

    // Reparto: medir y arrancar desde el zapato.
    useLayoutEffect(() => {
        const el = ref.current;
        const origen = desdeRef?.current;
        if (!el || !origen) { setEnSitio(true); return; }

        const a = el.getBoundingClientRect();
        const b = origen.getBoundingClientRect();
        const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
        const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
        // Un pelín girada, distinto para cada carta: dos cartas que llegan con
        // el mismo giro exacto se ven como pegatinas.
        const torcida = (Math.random() * 10 - 5).toFixed(1);
        setTransformInicial(`translate(${dx}px, ${dy}px) rotate(${torcida}deg) scale(0.9)`);

        let id2 = null;
        const id = setTimeout(() => {
            alRepartir?.();
            // Un frame más para que el navegador registre el transform inicial
            // antes de cambiarlo: si no, no hay transición.
            id2 = requestAnimationFrame(() => setEnSitio(true));
        }, retraso);
        // ⚠️ Si rAF no dispara (pestaña en segundo plano), la carta se coloca
        // igual en su sitio: mejor sin deslizar que sin aparecer.
        const salvavidas = setTimeout(() => setEnSitio(true), retraso + 120);
        return () => { clearTimeout(id); clearTimeout(salvavidas); if (id2) cancelAnimationFrame(id2); };
        // Solo al montar: el origen y el retraso no cambian para una carta viva.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Volteo: cuando deja de estar oculta.
    useLayoutEffect(() => {
        if (!nacioOculta.current) return;
        if (!oculta && giro !== 0) {
            setGiro(0);
            if (!avisadoVolteo.current) { avisadoVolteo.current = true; alVoltear?.(); }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [oculta]);

    const llegando = transformInicial && !enSitio;

    return (
        <div
            ref={ref}
            className={`shrink-0 ${className}`}
            style={{
                width: ancho,
                height: alto,
                perspective: 600,
                transform: llegando ? transformInicial : 'translate(0px, 0px) rotate(0deg) scale(1)',
                transition: enSitio ? 'transform 420ms cubic-bezier(0.22, 0.9, 0.3, 1)' : 'none',
                willChange: 'transform',
                // Mientras llega va por encima de las que ya están: sale del zapato
                // y aterriza sobre la mano, no por debajo.
                zIndex: llegando ? 30 : undefined,
                position: 'relative'
            }}
        >
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transform: `rotateY(${giro}deg)`,
                    transition: 'transform 480ms cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
                    {cara}
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    {dorso}
                </div>
            </div>
        </div>
    );
}
