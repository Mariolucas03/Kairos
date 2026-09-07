/**
 * QUÉ HAS LEVANTADO HOY, EN COSAS DE VERDAD
 *
 * El resumen del entreno decía "2,2 t de volumen". Es un número correcto y
 * completamente vacío: nadie tiene ni idea de si dos toneladas es mucho o poco,
 * porque nadie ha levantado nunca dos toneladas de nada. "Has levantado un
 * rinoceronte" sí se entiende, y encima da ganas de contarlo.
 *
 * ⚠️ SIEMPRE UNA SOLA COSA. NUNCA "3 CAMIONES".
 *
 * La primera versión multiplicaba: cogía cualquier objeto de la lista y decía
 * cuántos cabían. Pero "has levantado 7 sofás" no es una imagen, es una cuenta —
 * hay que pararse a multiplicar para saber si eso es mucho, que es justo el
 * problema que esto venía a resolver. "Has levantado un tiranosaurio" se ve de
 * golpe.
 *
 * Para que eso funcione, la lista tiene que ser DENSA: si solo hubiera diez
 * objetos, la mayoría de los entrenos caerían entre dos y no habría nada que
 * decir. Por eso hay más de setenta, repartidos desde un sofá hasta el Titanic,
 * y siempre hay varios candidatos que pesan parecido a lo que has movido. De
 * ahí sale uno al azar, así que el mismo entreno dos días seguidos no da la
 * misma frase.
 *
 * Los pesos son REALES (aproximados a lo que dicen las fuentes habituales). Un
 * dato inventado se nota y se lo carga: la gracia depende de que te puedas fiar.
 */

// De menos a más. Los emojis son de los antiguos a propósito: los recientes no
// se dibujan en Windows 10 ni en móviles sin actualizar, y un cuadrito vacío en
// mitad de la frase la estropea.
const COSAS = [
    // --- Lo que hay en una casa o en la calle ---
    { kg: 60, uno: 'un sofá', emoji: '🛋️' },
    { kg: 75, uno: 'una moto de agua', emoji: '🌊' },
    { kg: 90, uno: 'un cerdo adulto', emoji: '🐖' },
    { kg: 110, uno: 'un oso panda', emoji: '🐼' },
    { kg: 120, uno: 'un avestruz', emoji: '🦤' },
    { kg: 140, uno: 'una lavadora industrial', emoji: '🧺' },
    { kg: 160, uno: 'un delfín', emoji: '🐬' },
    { kg: 180, uno: 'un gorila espalda plateada', emoji: '🦍' },
    { kg: 190, uno: 'un león', emoji: '🦁' },
    { kg: 200, uno: 'una moto', emoji: '🏍️' },
    { kg: 220, uno: 'un tigre de Bengala', emoji: '🐅' },
    { kg: 250, uno: 'un piano vertical', emoji: '🎹' },
    { kg: 280, uno: 'una tortuga laúd', emoji: '🐢' },
    { kg: 300, uno: 'una máquina expendedora llena', emoji: '🥤' },
    { kg: 350, uno: 'un oso pardo', emoji: '🐻' },
    { kg: 400, uno: 'un piano de cola', emoji: '🎹' },
    { kg: 450, uno: 'un caballo', emoji: '🐴' },
    { kg: 500, uno: 'una campana de iglesia pequeña', emoji: '🔔' },
    { kg: 550, uno: 'un tiburón blanco', emoji: '🦈' },
    { kg: 600, uno: 'un alce', emoji: '🦌' },
    { kg: 650, uno: 'un camello', emoji: '🐫' },
    { kg: 700, uno: 'un toro bravo', emoji: '🐂' },
    { kg: 750, uno: 'una vaca', emoji: '🐄' },
    { kg: 800, uno: 'una cabina telefónica británica', emoji: '☎️' },
    { kg: 900, uno: 'un bisonte americano', emoji: '🐃' },
    { kg: 1000, uno: 'un cocodrilo marino', emoji: '🐊' },
    { kg: 1100, uno: 'un coche pequeño', emoji: '🚗' },
    { kg: 1200, uno: 'una morsa', emoji: '🦭' },
    { kg: 1300, uno: 'una avioneta', emoji: '✈️' },
    { kg: 1500, uno: 'un hipopótamo', emoji: '🦛' },
    { kg: 1700, uno: 'una jirafa', emoji: '🦒' },
    { kg: 2000, uno: 'una furgoneta', emoji: '🚐' },
    { kg: 2300, uno: 'un rinoceronte blanco', emoji: '🦏' },
    { kg: 2500, uno: 'un bloque de la Gran Pirámide', emoji: '🔺' },
    { kg: 2800, uno: 'un helicóptero', emoji: '🚁' },
    { kg: 3000, uno: 'una campana de catedral', emoji: '🔔' },
    { kg: 3500, uno: 'un elefante asiático', emoji: '🐘' },
    { kg: 4000, uno: 'un tractor', emoji: '🚜' },
    { kg: 4500, uno: 'una orca joven', emoji: '🐋' },
    { kg: 5000, uno: 'un elefante africano', emoji: '🐘' },
    { kg: 5500, uno: 'una orca', emoji: '🐋' },
    { kg: 6000, uno: 'un mamut lanudo', emoji: '🦣' },
    { kg: 7000, uno: 'una autocaravana', emoji: '🚙' },
    { kg: 8000, uno: 'un tiranosaurio', emoji: '🦖' },
    { kg: 9000, uno: 'un triceratops', emoji: '🦕' },
    { kg: 10000, uno: 'un contenedor de obra lleno', emoji: '🏗️' },
    { kg: 12000, uno: 'un autobús urbano', emoji: '🚌' },
    { kg: 12500, uno: 'un moái de la Isla de Pascua', emoji: '🗿' },
    { kg: 13800, uno: 'la campana del Big Ben', emoji: '🕰️' },
    { kg: 15000, uno: 'un diplodocus', emoji: '🦕' },
    { kg: 16000, uno: 'un camión de bomberos', emoji: '🚒' },
    { kg: 20000, uno: 'una excavadora', emoji: '🚧' },
    { kg: 25000, uno: 'una piedra de Stonehenge', emoji: '🗿' },
    { kg: 30000, uno: 'un contenedor de barco lleno', emoji: '📦' },
    { kg: 33000, uno: 'un vagón de metro', emoji: '🚇' },
    { kg: 40000, uno: 'un braquiosaurio', emoji: '🦕' },
    { kg: 45000, uno: 'un cachalote', emoji: '🐳' },
    { kg: 55000, uno: 'un camión con remolque cargado', emoji: '🚛' },
    { kg: 62000, uno: 'un tanque Abrams', emoji: '🛡️' },
    { kg: 70000, uno: 'una ballena de aleta', emoji: '🐋' },
    { kg: 79000, uno: 'un Boeing 737 al despegar', emoji: '🛫' },
    { kg: 90000, uno: 'una casa de dos plantas', emoji: '🏠' },
    { kg: 120000, uno: 'una locomotora diésel', emoji: '🚂' },
    { kg: 150000, uno: 'una ballena azul', emoji: '🐋' },
    { kg: 183500, uno: 'un Boeing 747 vacío', emoji: '✈️' },
    { kg: 202000, uno: 'la Campana del Zar de Moscú', emoji: '🔔' },
    { kg: 225000, uno: 'la Estatua de la Libertad', emoji: '🗽' },
    { kg: 250000, uno: 'el obelisco de Luxor de París', emoji: '🏛️' },
    { kg: 277000, uno: 'un Airbus A380 vacío', emoji: '🛩️' },
    { kg: 400000, uno: 'un remolcador de puerto', emoji: '⛴️' },
    { kg: 635000, uno: 'el Cristo Redentor de Río', emoji: '⛰️' },
    { kg: 1000000, uno: 'un rascacielos de oficinas pequeño', emoji: '🏢' },
    { kg: 2030000, uno: 'un transbordador espacial al despegar', emoji: '🚀' },
    { kg: 2100000, uno: 'la noria London Eye', emoji: '🎡' },
    { kg: 2970000, uno: 'un cohete Saturn V lleno', emoji: '🚀' },
    { kg: 5000000, uno: 'un ferry de coches', emoji: '🛳️' },
    { kg: 7300000, uno: 'la Torre Eiffel', emoji: '🗼' },
    { kg: 7900000, uno: 'un submarino nuclear', emoji: '🌀' },
    { kg: 15000000, uno: 'el Arco del Triunfo de París', emoji: '🏛️' },
    { kg: 52310000, uno: 'el Titanic', emoji: '🚢' },
    { kg: 100000000, uno: 'un portaaviones', emoji: '⚓' },
    { kg: 228000000, uno: 'el mayor crucero del mundo', emoji: '🛳️' }
];

/**
 * ⚠️ LA COSA TIENE QUE PESAR ALGO PARECIDO A LO QUE HAS MOVIDO.
 *
 * Si valiera cualquier cosa más ligera, un entreno de 10.000 kg podría salir
 * como "un sofá" —cierto, y ridículo—. El suelo es el 55%: la cosa elegida pesa
 * entre la mitad larga y el total de lo que has levantado, así que la frase
 * siempre se queda corta antes que pasarse. Nunca dice que has levantado algo
 * más pesado de lo que has levantado.
 */
const SUELO = 0.55;

// Si con el 55% no hay nada (un hueco de la lista), se abre la mano antes que
// quedarse sin frase.
const SUELO_AMPLIO = 0.25;

/**
 * @param {number} volumen  kilos totales movidos
 * @returns {Object|null}   { emoji, cosa, frase, detalle } o null si no llega ni a lo más ligero
 */
export function loQueHasLevantado(volumen) {
    const kilos = Math.round(Number(volumen) || 0);
    if (!Number.isFinite(kilos) || kilos < COSAS[0].kg) return null;

    const entre = (suelo) => COSAS.filter(c => c.kg <= kilos && c.kg >= kilos * suelo);

    let posibles = entre(SUELO);
    if (posibles.length === 0) posibles = entre(SUELO_AMPLIO);
    // Ultimo recurso: la más pesada que quepa. Solo puede pasar con un volumen
    // por encima del crucero, que son 228.000 toneladas.
    if (posibles.length === 0) posibles = [[...COSAS].reverse().find(c => c.kg <= kilos)];
    if (!posibles[0]) return null;

    const c = posibles[Math.floor(Math.random() * posibles.length)];

    // `cosa` va suelto a proposito: en el feed el entreno es de OTRO, y ahi
    // "Has levantado un helicoptero" es directamente falso. Quien lo usa pone el
    // sujeto que le toca.
    return {
        emoji: c.emoji,
        cosa: c.uno,
        frase: `Has levantado ${c.uno}`,
        detalle: `${kilos.toLocaleString('es-ES')} kg en total · ${c.uno} pesa unos ${c.kg.toLocaleString('es-ES')} kg`
    };
}

export { COSAS };
