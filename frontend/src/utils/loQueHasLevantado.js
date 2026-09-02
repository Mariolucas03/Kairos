/**
 * QUÉ HAS LEVANTADO HOY, EN COSAS DE VERDAD
 *
 * El resumen del entreno decía "2,2 t de volumen". Es un número correcto y
 * completamente vacío: nadie tiene ni idea de si dos toneladas es mucho o poco,
 * porque nadie ha levantado nunca dos toneladas de nada. "Has levantado un
 * rinoceronte" sí se entiende, y encima da ganas de contarlo.
 *
 * Se elige AL AZAR entre las que salen a cuenta redonda, así que el mismo
 * entreno dos semanas seguidas no da la misma frase. Esa es media gracia.
 */

// Pesos aproximados, de menos a más. Los emojis son todos de los antiguos
// (Emoji 5.0 o anterior): los nuevos no se dibujan en Windows 10 ni en móviles
// que no se actualizan, y un cuadrito vacío en mitad de la frase la estropea.
const COSAS = [
    { kg: 60, uno: 'un sofá', varios: 'sofás', emoji: '🛋️' },
    { kg: 180, uno: 'un gorila', varios: 'gorilas', emoji: '🦍' },
    { kg: 200, uno: 'una moto', varios: 'motos', emoji: '🏍️' },
    { kg: 350, uno: 'un oso pardo', varios: 'osos pardos', emoji: '🐻' },
    { kg: 400, uno: 'un piano de cola', varios: 'pianos de cola', emoji: '🎹' },
    { kg: 750, uno: 'una vaca', varios: 'vacas', emoji: '🐄' },
    { kg: 900, uno: 'un caballo percherón', varios: 'caballos percherones', emoji: '🐎' },
    { kg: 1100, uno: 'un coche', varios: 'coches', emoji: '🚗' },
    { kg: 1200, uno: 'una jirafa', varios: 'jirafas', emoji: '🦒' },
    { kg: 1300, uno: 'una avioneta', varios: 'avionetas', emoji: '✈️' },
    { kg: 2300, uno: 'un rinoceronte', varios: 'rinocerontes', emoji: '🦏' },
    { kg: 2500, uno: 'un helicóptero', varios: 'helicópteros', emoji: '🚁' },
    { kg: 3000, uno: 'una campana de catedral', varios: 'campanas de catedral', emoji: '🔔' },
    { kg: 4000, uno: 'un tractor', varios: 'tractores', emoji: '🚜' },
    { kg: 5500, uno: 'una orca', varios: 'orcas', emoji: '🐋' },
    { kg: 6000, uno: 'un mamut', varios: 'mamuts', emoji: '🐘' },
    { kg: 8000, uno: 'un tiranosaurio', varios: 'tiranosaurios', emoji: '🦖' },
    { kg: 12500, uno: 'un moái de la Isla de Pascua', varios: 'moáis de la Isla de Pascua', emoji: '🗿' },
    { kg: 13000, uno: 'un autobús', varios: 'autobuses', emoji: '🚌' },
    { kg: 15000, uno: 'un camión', varios: 'camiones', emoji: '🚚' },
    { kg: 150000, uno: 'una ballena azul', varios: 'ballenas azules', emoji: '🐋' }
];

// Como mucho quince: "has levantado 47 sofás" no impresiona, aburre. La gracia
// está en las que salen a una, dos o tres.
const MAXIMO = 15;

/**
 * @param {number} volumen  kilos totales movidos en la sesión
 * @returns {Object|null}   { emoji, frase, detalle } o null si no da ni para un sofá
 */
export function loQueHasLevantado(volumen) {
    const kilos = Math.round(Number(volumen) || 0);
    if (kilos < COSAS[0].kg) return null;

    const posibles = COSAS
        .map(c => ({ ...c, veces: Math.floor(kilos / c.kg) }))
        .filter(c => c.veces >= 1 && c.veces <= MAXIMO);

    // No debería pasar —la más ligera siempre cabe si hemos llegado hasta aquí—
    // pero un volumen enorme podría dejar todas por encima del tope.
    if (posibles.length === 0) return null;

    const c = posibles[Math.floor(Math.random() * posibles.length)];

    return {
        emoji: c.emoji,
        frase: c.veces === 1 ? `Has levantado ${c.uno}` : `Has levantado ${c.veces} ${c.varios}`,
        detalle: `${kilos.toLocaleString('es-ES')} kg en total · ${c.uno} pesa unos ${c.kg.toLocaleString('es-ES')} kg`
    };
}

export { COSAS };
