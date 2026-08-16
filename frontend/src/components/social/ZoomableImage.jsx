import { useRef, useState } from 'react';

/**
 * Foto del post: fija, sin scroll, y con zoom.
 *
 * - Pellizcar con dos dedos amplía hasta 4x y deja arrastrar la foto dentro del
 *   marco; al soltar por debajo de 1.05x vuelve sola a su sitio.
 * - Doble toque (o doble clic) alterna entre 1x y 2x sobre el punto tocado.
 *
 * Mientras hay zoom se bloquea el gesto horizontal para que el carrusel no se
 * lleve el dedo cuando lo que quieres es mover la foto.
 */
export default function ZoomableImage({ src, alt = '' }) {
    const marcoRef = useRef(null);
    const [escala, setEscala] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });

    const gesto = useRef(null);       // datos del pellizco en curso
    const arrastre = useRef(null);    // datos del arrastre con un dedo
    const ultimoToque = useRef(0);

    const distancia = (t) => Math.hypot(
        t[0].clientX - t[1].clientX,
        t[0].clientY - t[1].clientY
    );

    const limitar = (valor, tope) => Math.max(-tope, Math.min(tope, valor));

    // Con la foto ampliada solo se puede desplazar hasta el borde de la imagen
    const recolocar = (nuevaEscala, x, y) => {
        const marco = marcoRef.current;
        if (!marco) return { x, y };
        const topeX = (marco.clientWidth * (nuevaEscala - 1)) / 2;
        const topeY = (marco.clientHeight * (nuevaEscala - 1)) / 2;
        return { x: limitar(x, topeX), y: limitar(y, topeY) };
    };

    const onTouchStart = (e) => {
        if (e.touches.length === 2) {
            e.stopPropagation();
            gesto.current = { d0: distancia(e.touches), e0: escala };
        } else if (e.touches.length === 1) {
            const ahora = Date.now();
            if (ahora - ultimoToque.current < 300) {
                // Doble toque: acercar o volver
                const objetivo = escala > 1.05 ? 1 : 2;
                setEscala(objetivo);
                setPos(objetivo === 1 ? { x: 0, y: 0 } : recolocar(objetivo, 0, 0));
            }
            ultimoToque.current = ahora;
            if (escala > 1.05) {
                arrastre.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, ...pos };
            }
        }
    };

    const onTouchMove = (e) => {
        if (e.touches.length === 2 && gesto.current) {
            e.stopPropagation();
            const nueva = Math.min(4, Math.max(1, gesto.current.e0 * (distancia(e.touches) / gesto.current.d0)));
            setEscala(nueva);
            setPos(p => recolocar(nueva, p.x, p.y));
        } else if (e.touches.length === 1 && arrastre.current && escala > 1.05) {
            // Con zoom, el dedo mueve la foto y no el carrusel
            e.stopPropagation();
            const dx = e.touches[0].clientX - arrastre.current.x0;
            const dy = e.touches[0].clientY - arrastre.current.y0;
            setPos(recolocar(escala, arrastre.current.x + dx, arrastre.current.y + dy));
        }
    };

    const onTouchEnd = () => {
        gesto.current = null;
        arrastre.current = null;
        if (escala < 1.05) {
            setEscala(1);
            setPos({ x: 0, y: 0 });
        }
    };

    const onDoubleClick = () => {
        const objetivo = escala > 1.05 ? 1 : 2;
        setEscala(objetivo);
        setPos({ x: 0, y: 0 });
    };

    const conZoom = escala > 1.05;

    // ⚠️ 'pan-y' a secas impedía el gesto HORIZONTAL: el navegador se comía el
    // deslizamiento y no se podía pasar de la foto al cuerpo ni al entreno.
    // Con 'pan-x pan-y' el carrusel desliza y el pellizco sigue siendo nuestro.
    const touchAction = conZoom ? 'none' : 'pan-x pan-y';

    return (
        <div
            ref={marcoRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onDoubleClick={onDoubleClick}
            className="w-full h-full overflow-hidden bg-black relative select-none"
            style={{ touchAction }}
        >
            <img
                src={src}
                alt={alt}
                draggable={false}
                className="w-full h-full object-cover origin-center"
                style={{
                    transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`,
                    transition: gesto.current || arrastre.current ? 'none' : 'transform 0.25s ease-out'
                }}
            />
            {conZoom && (
                <button
                    onClick={() => { setEscala(1); setPos({ x: 0, y: 0 }); }}
                    className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border border-white/20"
                >
                    {escala.toFixed(1)}× · Restablecer
                </button>
            )}
        </div>
    );
}
