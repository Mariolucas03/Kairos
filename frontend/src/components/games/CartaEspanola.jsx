/**
 * UNA CARTA DE LA BARAJA ESPAÑOLA.
 *
 * Dibujada, no una imagen: cuarenta ficheros para algo que son cuatro formas y
 * un número serían cuarenta descargas más en un móvil con datos, y encima
 * borrosas al ampliarlas. Así escala a cualquier tamaño y pesa cero.
 *
 * Los cuatro palos con su color de siempre — oros dorado, copas rojo, espadas
 * azul acero, bastos verde — para que se distingan de un vistazo sin leer.
 */

const PALOS = {
    oros: { color: '#eab308', fondo: '#2a2208', nombre: 'Oros' },
    copas: { color: '#ef4444', fondo: '#2a0f0f', nombre: 'Copas' },
    espadas: { color: '#60a5fa', fondo: '#0f1c2a', nombre: 'Espadas' },
    bastos: { color: '#22c55e', fondo: '#0f2416', nombre: 'Bastos' }
};

const NOMBRES = {
    1: 'AS', 2: '2', 3: '3', 4: '4', 5: '5',
    6: '6', 7: '7', 10: 'SOTA', 11: 'CABALLO', 12: 'REY'
};

/**
 * Cada carta lleva SU NÚMERO: 1 al 7, y 10, 11 y 12 para sota, caballo y rey.
 *
 * Antes iban con la inicial (A, S, C, R) y era peor de leer: hay que saberse
 * que la C es el caballo y no el cinco, y sobre todo hay que traducir la letra a
 * un sitio en la escalera para saber si tu carta gana. Con el número, el 12 se
 * ve mayor que el 11 sin pensar.
 */
const etiquetaCorta = (n) => String(n);

function Simbolo({ palo, size = 40, color }) {
    const comun = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

    if (palo === 'oros') {
        return (
            <svg {...comun} aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1.6" fill={color} stroke="none" />
            </svg>
        );
    }
    if (palo === 'copas') {
        return (
            <svg {...comun} aria-hidden="true">
                <path d="M6.5 4h11v3.5a5.5 5.5 0 0 1-11 0V4Z" />
                <path d="M12 13v5" />
                <path d="M8 20h8" />
                <path d="M6.5 6h11" />
            </svg>
        );
    }
    if (palo === 'espadas') {
        return (
            <svg {...comun} aria-hidden="true">
                <path d="M12 2.5 14 8v9h-4V8l2-5.5Z" />
                <path d="M7.5 17h9" />
                <path d="M12 17v4" />
                <path d="M10 21h4" />
            </svg>
        );
    }
    return (
        <svg {...comun} aria-hidden="true">
            <path d="M5 19.5 17.5 7" />
            <path d="M14.5 4.2 19.8 9.5" />
            <path d="M15.5 8.5l-2-2" />
            <path d="M12.5 11.5l-2-2" />
            <path d="M9.5 14.5l-2-2" />
        </svg>
    );
}

/**
 * @param {object|null} carta  { numero, palo } — null pinta el dorso
 * @param {'sm'|'md'|'lg'} tamano
 * @param {boolean} apagada    para el panel de cartas ya salidas
 */
export default function CartaEspanola({ carta, tamano = 'md', apagada = false, className = '' }) {
    const medidas = {
        sm: { ancho: 38, alto: 56, cifra: 13, simbolo: 18, radio: 6 },
        md: { ancho: 92, alto: 134, cifra: 24, simbolo: 44, radio: 12 },
        lg: { ancho: 118, alto: 172, cifra: 30, simbolo: 58, radio: 14 }
    }[tamano];

    // Dorso: cuando aún no has levantado, o la del rival antes de resolverse
    if (!carta) {
        return (
            <div
                className={`relative shrink-0 overflow-hidden ${className}`}
                style={{
                    width: medidas.ancho, height: medidas.alto, borderRadius: medidas.radio,
                    background: 'repeating-linear-gradient(45deg, #18181b 0 6px, #101012 6px 12px)',
                    border: '1px solid rgba(255,255,255,0.10)'
                }}
                aria-label="Carta boca abajo"
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-zinc-700 font-black" style={{ fontSize: medidas.simbolo * 0.55 }}>?</span>
                </div>
            </div>
        );
    }

    const p = PALOS[carta.palo] || PALOS.oros;
    const corta = etiquetaCorta(carta.numero);

    return (
        <div
            className={`relative shrink-0 flex flex-col overflow-hidden ${className}`}
            style={{
                width: medidas.ancho, height: medidas.alto, borderRadius: medidas.radio,
                background: apagada ? '#0d0d0f' : `linear-gradient(160deg, ${p.fondo}, #0a0a0c 70%)`,
                border: `1px solid ${apagada ? 'rgba(255,255,255,0.06)' : p.color + '55'}`,
                opacity: apagada ? 0.32 : 1,
                padding: tamano === 'sm' ? 3 : 7
            }}
            aria-label={`${NOMBRES[carta.numero]} de ${p.nombre}`}
        >
            <span
                className="font-black leading-none"
                style={{ fontSize: medidas.cifra, color: p.color, letterSpacing: '-0.04em' }}
            >
                {corta}
            </span>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Simbolo palo={carta.palo} size={medidas.simbolo} color={p.color} />
            </div>

            {/* Sin el número repetido y girado abajo, que es de baraja
                francesa. En una española va arriba y ya — y además el 6 girado
                se lee como un 9 y el 10 como "0L", que en un juego donde la
                carta decide quién cobra no es un detalle bonito. */}
        </div>
    );
}

export { PALOS, NOMBRES };
