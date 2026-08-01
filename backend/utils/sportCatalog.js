/**
 * CATÁLOGO DE DEPORTES
 *
 * Lista fija para que registrar una actividad sea elegir de una rejilla en vez
 * de escribir el nombre a mano (que además provocaba que "Padel", "padel" y
 * "Pádel" contasen como cosas distintas).
 *
 * `met` es el equivalente metabólico del deporte a intensidad media. Sirve de
 * PLAN B para calcular las calorías sin depender de la IA:
 *
 *     kcal = MET × peso(kg) × horas
 *
 * `distance` indica si tiene sentido pedir kilómetros: en tenis o pesas no.
 */
const SPORTS = [
    // --- Correr y caminar ---
    { id: 'andar', name: 'Andar', icon: '🚶', met: 3.5, distance: true, group: 'Aeróbico' },
    { id: 'correr', name: 'Correr', icon: '🏃', met: 9.8, distance: true, group: 'Aeróbico' },
    { id: 'senderismo', name: 'Senderismo', icon: '🥾', met: 6.0, distance: true, group: 'Aeróbico' },
    { id: 'trail', name: 'Trail', icon: '⛰️', met: 10.5, distance: true, group: 'Aeróbico' },

    // --- Ruedas y agua ---
    { id: 'ciclismo', name: 'Ciclismo', icon: '🚴', met: 8.0, distance: true, group: 'Aeróbico' },
    { id: 'spinning', name: 'Spinning', icon: '🚲', met: 8.5, distance: false, group: 'Aeróbico' },
    { id: 'natacion', name: 'Natación', icon: '🏊', met: 8.3, distance: true, group: 'Aeróbico' },
    { id: 'remo', name: 'Remo', icon: '🚣', met: 7.0, distance: true, group: 'Aeróbico' },
    { id: 'patinaje', name: 'Patinaje', icon: '🛼', met: 7.5, distance: true, group: 'Aeróbico' },
    { id: 'surf', name: 'Surf', icon: '🏄', met: 5.0, distance: false, group: 'Aeróbico' },
    { id: 'esqui', name: 'Esquí', icon: '⛷️', met: 7.0, distance: true, group: 'Aeróbico' },

    // --- Raqueta y pelota ---
    { id: 'padel', name: 'Pádel', icon: '🎾', met: 7.0, distance: false, group: 'Raqueta y pelota' },
    { id: 'tenis', name: 'Tenis', icon: '🎾', met: 7.3, distance: false, group: 'Raqueta y pelota' },
    { id: 'futbol', name: 'Fútbol', icon: '⚽', met: 7.0, distance: true, group: 'Raqueta y pelota' },
    { id: 'baloncesto', name: 'Baloncesto', icon: '🏀', met: 6.5, distance: false, group: 'Raqueta y pelota' },
    { id: 'voleibol', name: 'Voleibol', icon: '🏐', met: 4.0, distance: false, group: 'Raqueta y pelota' },
    { id: 'balonmano', name: 'Balonmano', icon: '🤾', met: 8.0, distance: false, group: 'Raqueta y pelota' },
    { id: 'ping-pong', name: 'Ping-pong', icon: '🏓', met: 4.0, distance: false, group: 'Raqueta y pelota' },
    { id: 'golf', name: 'Golf', icon: '⛳', met: 4.8, distance: true, group: 'Raqueta y pelota' },

    // --- Fuerza y combate ---
    { id: 'crossfit', name: 'CrossFit', icon: '🏋️', met: 8.0, distance: false, group: 'Fuerza y combate' },
    { id: 'calistenia', name: 'Calistenia', icon: '🤸', met: 6.0, distance: false, group: 'Fuerza y combate' },
    { id: 'escalada', name: 'Escalada', icon: '🧗', met: 8.0, distance: false, group: 'Fuerza y combate' },
    { id: 'boxeo', name: 'Boxeo', icon: '🥊', met: 9.0, distance: false, group: 'Fuerza y combate' },
    { id: 'artes-marciales', name: 'Artes marciales', icon: '🥋', met: 10.3, distance: false, group: 'Fuerza y combate' },

    // --- Cuerpo y mente ---
    { id: 'yoga', name: 'Yoga', icon: '🧘', met: 3.0, distance: false, group: 'Cuerpo y mente' },
    { id: 'pilates', name: 'Pilates', icon: '🤍', met: 3.8, distance: false, group: 'Cuerpo y mente' },
    { id: 'estiramientos', name: 'Estiramientos', icon: '🙆', met: 2.3, distance: false, group: 'Cuerpo y mente' },
    { id: 'baile', name: 'Baile', icon: '💃', met: 5.5, distance: false, group: 'Cuerpo y mente' },

    // --- Comodín ---
    { id: 'otro', name: 'Otro', icon: '✨', met: 5.0, distance: true, group: 'Otros' }
];

const byId = {};
SPORTS.forEach(s => { byId[s.id] = s; });

const getSport = (id) => byId[String(id || '').toLowerCase()] || null;

/**
 * Calorías sin IA: fórmula MET estándar, ajustada por intensidad.
 * Es el plan B, y también el tope de cordura para lo que devuelva la IA.
 */
const estimateCalories = ({ sportId, minutes, weightKg = 75, intensity = 'Media' }) => {
    const sport = getSport(sportId);
    const met = sport ? sport.met : 5;
    const factor = intensity === 'Alta' ? 1.25 : intensity === 'Baja' ? 0.75 : 1;
    return Math.round(met * factor * weightKg * (Math.max(0, minutes) / 60));
};

module.exports = { SPORTS, getSport, estimateCalories };
