/**
 * UNA CARTA DE PÓQUER (baraja francesa).
 *
 * Dibujada, no una imagen: 52 ficheros para cuatro símbolos y un número serían
 * 52 descargas más en un móvil con datos, y borrosas al ampliarlas.
 *
 * Rojos y negros como toda la vida, pero los negros en un gris muy claro y no en
 * negro puro: sobre el fondo de la app un símbolo negro no se ve.
 */

const PALOS = {
    picas: { simbolo: '♠', color: '#e4e4e7', nombre: 'Picas' },
    corazones: { simbolo: '♥', color: '#f43f5e', nombre: 'Corazones' },
    diamantes: { simbolo: '♦', color: '#f43f5e', nombre: 'Diamantes' },
    treboles: { simbolo: '♣', color: '#e4e4e7', nombre: 'Tréboles' }
};

const NOMBRES = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

const MEDIDAS = {
    xs: { ancho: 26, alto: 38, cifra: 11, simbolo: 12, radio: 4 },
    sm: { ancho: 38, alto: 55, cifra: 15, simbolo: 17, radio: 6 },
    md: { ancho: 52, alto: 74, cifra: 19, simbolo: 22, radio: 8 },
    lg: { ancho: 66, alto: 94, cifra: 24, simbolo: 28, radio: 10 }
};

/**
 * @param {object|null} carta  { valor, palo } — null pinta el dorso
 * @param {boolean} apagada    para las cartas que no forman la jugada
 */
export default function CartaPoker({ carta, tamano = 'md', apagada = false, className = '' }) {
    const m = MEDIDAS[tamano] || MEDIDAS.md;

    if (!carta) {
        return (
            <div
                className={`shrink-0 ${className}`}
                style={{
                    width: m.ancho, height: m.alto, borderRadius: m.radio,
                    background: 'repeating-linear-gradient(45deg, #1b1b20 0 5px, #101014 5px 10px)',
                    border: '1px solid rgba(255,255,255,0.10)'
                }}
                aria-label="Carta tapada"
            />
        );
    }

    const p = PALOS[carta.palo] || PALOS.picas;

    return (
        <div
            className={`shrink-0 flex flex-col items-center justify-center ${className}`}
            style={{
                width: m.ancho, height: m.alto, borderRadius: m.radio,
                background: apagada ? '#111113' : '#f8f7f4',
                border: `1px solid ${apagada ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.25)'}`,
                opacity: apagada ? 0.35 : 1,
                lineHeight: 1
            }}
            aria-label={`${NOMBRES[carta.valor]} de ${p.nombre}`}
        >
            <span
                className="font-black"
                style={{
                    fontSize: m.cifra,
                    color: apagada ? '#52525b' : (p.color === '#e4e4e7' ? '#18181b' : '#dc2626'),
                    letterSpacing: '-0.05em'
                }}
            >
                {NOMBRES[carta.valor]}
            </span>
            <span
                style={{
                    fontSize: m.simbolo,
                    color: apagada ? '#3f3f46' : (p.color === '#e4e4e7' ? '#18181b' : '#dc2626'),
                    marginTop: -2
                }}
            >
                {p.simbolo}
            </span>
        </div>
    );
}

export { PALOS, NOMBRES };
