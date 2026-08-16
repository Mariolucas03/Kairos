/**
 * FAMILIAS DE EQUIPAMIENTO
 *
 * Segundo nivel del selector de ejercicios. Dentro de un grupo muscular hay
 * hasta 245 ejercicios, y en el gimnasio lo primero que decides no es el
 * músculo sino con qué lo haces: la máquina que está libre, la polea, o coger
 * unas mancuernas.
 *
 * El orden de las claves es el orden en que se pintan las secciones.
 */
const FAMILIA_EQUIPO = {
    'Pesas': ['Barra', 'Mancuernas', 'Barra Z', 'Kettlebell'],
    'Máquina': ['Máquina', 'Multipower', 'Trineo'],
    'Polea': ['Polea'],
    'Peso corporal': ['Peso Corporal'],
    'Otros': ['Banda Elástica', 'Otro']
};

const FAMILIAS = Object.keys(FAMILIA_EQUIPO);

// Índice inverso: 'Multipower' -> 'Máquina'
const EQUIPO_A_FAMILIA = Object.entries(FAMILIA_EQUIPO).reduce((acc, [familia, equipos]) => {
    equipos.forEach(e => { acc[e] = familia; });
    return acc;
}, {});

// Los ejercicios que crea el usuario no traen equipamiento, así que caen en
// 'Otros' en vez de desaparecer de la lista por no encajar en ninguna sección.
const familiaDe = (equipo) => EQUIPO_A_FAMILIA[equipo] || 'Otros';

module.exports = { FAMILIA_EQUIPO, FAMILIAS, EQUIPO_A_FAMILIA, familiaDe };
