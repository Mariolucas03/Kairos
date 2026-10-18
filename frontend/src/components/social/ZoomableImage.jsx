import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ZOOM DE LA FOTO, COMO EN INSTAGRAM.
 *
 * ⚠️ ANTES EL DOBLE TOQUE HACÍA ZOOM **Y** ME GUSTA.
 *
 * La tarjeta del post ya usa el doble toque para dar me gusta (con su corazón
 * grande), y esto lo usaba además para acercar. Un doble toque hacía las dos
 * cosas a la vez: te dejaba la foto al 2x y el corazón puesto. En Instagram el
 * doble toque es me gusta y punto; el zoom es pellizco y solo pellizco. Así se
 * queda.
 *
 * ⚠️ Y EL ZOOM NO SE QUEDA PUESTO.
 *
 * Antes la foto se quedaba ampliada dentro de su marco, con un botón de
 * "Restablecer" en una esquina para deshacerlo. Eso no es lo que hace nadie:
 * en Instagram pellizcas, la foto se levanta por encima de todo lo demás con
 * el fondo oscurecido, la mueves con los dedos, y al soltar vuelve sola a su
 * sitio. No hay estado que recordar ni botón que buscar.
 *
 * Mientras dura el pellizco la foto se pinta en un portal sobre el `body`, así
 * que puede salirse de su marco y del recorte del carrusel. Al soltar se
 * anima de vuelta a la posición exacta que ocupaba y el portal desaparece.
 */

const ESCALA_MAXIMA = 4;

export default function ZoomableImage({ src, alt = '' }) {
    const marcoRef = useRef(null);
    const gesto = useRef(null);

    // Mientras es null no hay pellizco y no se pinta nada encima.
    const [vista, setVista] = useState(null);
    const [volviendo, setVolviendo] = useState(false);

    const distancia = (t) => Math.hypot(
        t[0].clientX - t[1].clientX,
        t[0].clientY - t[1].clientY
    );

    const centro = (t) => ({
        x: (t[0].clientX + t[1].clientX) / 2,
        y: (t[0].clientY + t[1].clientY) / 2
    });

    const onTouchStart = (e) => {
        if (e.touches.length !== 2 || !marcoRef.current) return;

        // Se para aquí: si no, el carrusel se lleva el gesto.
        e.stopPropagation();

        const hueco = marcoRef.current.getBoundingClientRect();
        gesto.current = { d0: distancia(e.touches), c0: centro(e.touches) };
        setVolviendo(false);
        setVista({ hueco, escala: 1, x: 0, y: 0 });
    };

    const onTouchMove = (e) => {
        if (e.touches.length !== 2 || !gesto.current) return;
        e.stopPropagation();

        const c = centro(e.touches);
        const escala = Math.min(
            ESCALA_MAXIMA,
            Math.max(1, distancia(e.touches) / gesto.current.d0)
        );

        setVista(v => v && ({
            ...v,
            escala,
            // Libre: la gracia es que la foto siga a los dedos sin topes.
            x: c.x - gesto.current.c0.x,
            y: c.y - gesto.current.c0.y
        }));
    };

    const terminar = () => {
        if (!gesto.current) return;
        gesto.current = null;

        // Vuelve a su sitio con la animación puesta, y cuando llega se quita.
        setVolviendo(true);
        setVista(v => v && ({ ...v, escala: 1, x: 0, y: 0 }));
        setTimeout(() => { setVista(null); setVolviendo(false); }, 220);
    };

    const enPellizco = !!gesto.current;

    return (
        <>
            <div
                ref={marcoRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={terminar}
                onTouchCancel={terminar}
                className="w-full h-full overflow-hidden bg-black relative select-none"
                // Durante el pellizco el navegador no puede quedarse el gesto;
                // el resto del tiempo el carrusel tiene que poder deslizar.
                style={{ touchAction: enPellizco ? 'none' : 'pan-x pan-y' }}
            >
                <img
                    src={src}
                    alt={alt}
                    draggable={false}
                    className="w-full h-full object-cover"
                    // Mientras está levantada se oculta la de abajo: si no, se
                    // ve asomar por los bordes de la que flota.
                    style={{ opacity: vista ? 0 : 1 }}
                />
            </div>

            {vista && createPortal(
                <div
                    className="fixed inset-0 z-[300] pointer-events-none"
                    style={{
                        background: `rgba(0,0,0,${Math.min(0.9, (vista.escala - 1) * 0.6)})`,
                        transition: volviendo ? 'background 0.2s ease-out' : 'none'
                    }}
                >
                    <img
                        src={src}
                        alt={alt}
                        draggable={false}
                        className="absolute object-cover"
                        style={{
                            left: vista.hueco.left,
                            top: vista.hueco.top,
                            width: vista.hueco.width,
                            height: vista.hueco.height,
                            transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`,
                            transition: volviendo ? 'transform 0.2s ease-out' : 'none'
                        }}
                    />
                </div>,
                document.body
            )}
        </>
    );
}
