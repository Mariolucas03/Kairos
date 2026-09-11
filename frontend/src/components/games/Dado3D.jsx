import { forwardRef, memo } from 'react';
import { COLOCACION, PIPS } from '../../utils/fisicaDados';

/**
 * UN DADO DE VERDAD: SEIS CARAS EN 3D.
 *
 * Antes era una cifra grande que parpadeaba. Esto es un cubo con
 * `transform-style: preserve-3d`: seis caras planas colocadas cada una en su
 * sitio, con sus puntos, y el cubo entero se gira. Lo que se ve es la cara que
 * apunta al espectador, y eso lo decide la rotación (ver fisicaDados.js).
 *
 * ⚠️ EL GIRO NO LO HACE CSS. El juego escribe el transform del cubo frame a
 * frame por el `ref`, igual que en la ruleta y las tragaperras. Las props
 * `rotX/rotY/rotZ` solo importan al montar y entre tirada y tirada.
 *
 * El tamaño va en la variable `--m` (media arista): cada cara se saca hacia
 * fuera esa distancia, y así el cubo se puede hacer más grande o más pequeño
 * sin tocar la geometría.
 */
const Dado3D = forwardRef(function Dado3D({ tamaño = 88, rotX = 0, rotY = 0, rotZ = 0, color = '#f5f1e8' }, ref) {
    const m = tamaño / 2;

    return (
        <div
            ref={ref}
            className="relative"
            style={{
                width: tamaño,
                height: tamaño,
                '--m': `${m}px`,
                transformStyle: 'preserve-3d',
                transform: `rotateZ(${rotZ}deg) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
                willChange: 'transform'
            }}
        >
            {[1, 2, 3, 4, 5, 6].map(n => (
                <div
                    key={n}
                    className="absolute inset-0 grid grid-cols-3 grid-rows-3 place-items-center"
                    style={{
                        transform: COLOCACION[n],
                        backfaceVisibility: 'hidden',
                        // Marfil con un poco de sombra en los bordes: una cara
                        // plana de un color se ve como una pegatina.
                        background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${color} 55%, #d9d3c4 100%)`,
                        borderRadius: tamaño * 0.16,
                        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10), inset 0 -3px 6px rgba(0,0,0,0.12)',
                        padding: tamaño * 0.14
                    }}
                >
                    {Array.from({ length: 9 }, (_, i) => (
                        <span
                            key={i}
                            className="rounded-full"
                            style={{
                                width: tamaño * 0.16,
                                height: tamaño * 0.16,
                                // Los puntos están hundidos: brillo abajo a la
                                // derecha y sombra arriba a la izquierda.
                                background: PIPS[n].includes(i)
                                    ? 'radial-gradient(circle at 40% 35%, #3a3a3a 0%, #0c0c0c 70%)'
                                    : 'transparent',
                                boxShadow: PIPS[n].includes(i) ? 'inset 1px 1px 2px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.5)' : 'none'
                            }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
});

export default memo(Dado3D);
