/**
 * VOCABULARIO ÚNICO DE MÚSCULOS
 *
 * `Exercise.muscle` guarda SIEMPRE un grupo de esta lista: es la clave con la que
 * agregan getBodyStatus y getMuscleProgress. En modo PRO el usuario elige un
 * músculo concreto (`muscleDetail`) y el backend deriva su grupo padre desde
 * aquí, para que las estadísticas sigan funcionando igual en los dos modos.
 *
 * ⚠️ 'Glúteo' se ofrecía en el selector del frontend pero NO estaba en los grupos
 * que contaba getBodyStatus, así que esos ejercicios desaparecían de las
 * estadísticas. Al centralizar la lista aquí deja de pasar.
 */

const MUSCLE_GROUPS = [
    'Pecho',
    'Espalda',
    'Hombro',
    'Bíceps',
    'Tríceps',
    'Pierna',
    'Glúteo',
    'Abdomen'
];

/**
 * Músculos concretos (modo PRO) agrupados por su grupo padre.
 * Nombres en castellano de gimnasio, no de anatomía pura, para que se entiendan.
 */
const SPECIFIC_MUSCLES = {
    'Pecho': [
        'Pectoral superior',
        'Pectoral medio',
        'Pectoral inferior',
        'Serrato anterior'
    ],
    'Espalda': [
        'Dorsal ancho',
        'Trapecio superior',
        'Trapecio medio',
        'Trapecio inferior',
        'Romboides',
        'Redondo mayor',
        'Lumbar'
    ],
    'Hombro': [
        'Deltoides anterior',
        'Deltoides lateral',
        'Deltoides posterior',
        'Manguito rotador'
    ],
    'Bíceps': [
        'Bíceps braquial (cabeza larga)',
        'Bíceps braquial (cabeza corta)',
        'Braquial anterior',
        'Braquiorradial'
    ],
    'Tríceps': [
        'Tríceps (cabeza larga)',
        'Tríceps (cabeza lateral)',
        'Tríceps (cabeza medial)'
    ],
    'Pierna': [
        'Cuádriceps (recto femoral)',
        'Cuádriceps (vasto lateral)',
        'Cuádriceps (vasto medial)',
        'Isquiotibiales',
        'Aductores',
        'Abductores',
        'Gemelos',
        'Sóleo',
        'Tibial anterior'
    ],
    'Glúteo': [
        'Glúteo mayor',
        'Glúteo medio',
        'Glúteo menor'
    ],
    'Abdomen': [
        'Recto abdominal (superior)',
        'Recto abdominal (inferior)',
        'Oblicuos',
        'Transverso abdominal'
    ]
};

// Índice inverso: 'Dorsal ancho' -> 'Espalda'
const DETAIL_TO_GROUP = Object.entries(SPECIFIC_MUSCLES).reduce((acc, [grupo, detalles]) => {
    detalles.forEach(d => { acc[d.toLowerCase()] = grupo; });
    return acc;
}, {});

/**
 * Devuelve el grupo muscular válido a guardar en `Exercise.muscle`.
 * Acepta tanto un grupo ya válido como un músculo concreto del modo PRO.
 * Si no reconoce nada, cae en 'Pecho' para no romper la agregación.
 */
const resolveMuscleGroup = (value = '', fallback = 'Pecho') => {
    if (!value) return fallback;
    const limpio = String(value).trim();

    // ¿Ya es un grupo válido?
    const grupo = MUSCLE_GROUPS.find(g => g.toLowerCase() === limpio.toLowerCase());
    if (grupo) return grupo;

    // ¿Es un músculo concreto?
    return DETAIL_TO_GROUP[limpio.toLowerCase()] || fallback;
};

// ¿Es un músculo concreto conocido del modo PRO?
const isSpecificMuscle = (value = '') => !!DETAIL_TO_GROUP[String(value).trim().toLowerCase()];

module.exports = { MUSCLE_GROUPS, SPECIFIC_MUSCLES, resolveMuscleGroup, isSpecificMuscle };
