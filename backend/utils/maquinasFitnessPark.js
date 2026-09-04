/**
 * LAS MÁQUINAS DE FITNESSPARK.
 *
 * El catálogo general está en español ("Prensa de Piernas", "Extensión de
 * Cuádriceps") porque es un catálogo genérico. Estas van con el nombre que
 * llevan ROTULADO en la máquina, en inglés, porque es lo que lees cuando estás
 * delante de ella y lo que vas a buscar: nadie mira una Technogym y piensa
 * "extensión de cuádriceps", piensa "Leg Extension".
 *
 * Por eso son entradas propias y no etiquetas sobre las de siempre. Un mismo
 * movimiento puede estar dos veces en el catálogo con dos nombres, y está bien:
 * son dos formas de buscarlo, y la del gimnasio ademas te dice de qué marca es
 * el trasto que tienes delante.
 *
 * `gimnasios` es una lista y no un texto a propósito: el día que haya otra
 * cadena, una máquina puede estar en las dos sin duplicarla.
 *
 * ⚠️ Las tres del banco (Bench Press / Incline / Decline) vienen como una sola
 * linea en el listado del gimnasio, pero son tres bancos distintos y en una
 * rutina se eligen por separado, asi que aqui van desdobladas.
 */

const GIMNASIO = 'FitnessPark';

// nombre · grupo muscular · familia de equipamiento · marca · cardio
const MAQUINAS = [
    ['Abdominal Oblique Crunch', 'Abdomen', 'Máquina', 'Technogym'],
    ['Abductor', 'Glúteo', 'Máquina', 'Technogym'],
    ['Adductor', 'Pierna', 'Máquina', 'Technogym'],
    ['Arm Curl', 'Bíceps', 'Máquina', 'Technogym'],
    ['Arm Extension', 'Tríceps', 'Máquina', 'Technogym'],
    ['Assault Bike', 'Pierna', 'Máquina', 'Assault Fitness', true],
    ['Back Hyperextension', 'Espalda', 'Peso corporal', 'Technogym'],
    ['Belt Squat', 'Pierna', 'Máquina', 'Gym80'],
    ['Bench Press', 'Pecho', 'Pesas', 'Eleiko'],
    ['Incline Bench Press', 'Pecho', 'Pesas', 'Eleiko'],
    ['Decline Bench Press', 'Pecho', 'Pesas', 'Eleiko'],
    ['Bike', 'Pierna', 'Máquina', 'Technogym', true],
    ['Cable (todas las variantes)', 'Espalda', 'Polea', 'Technogym'],
    ['Chest Butterfly Dual', 'Pecho', 'Máquina', 'Technogym'],
    ['Chest Press', 'Pecho', 'Máquina', 'Technogym'],
    ['Chest Press Plate Loaded', 'Pecho', 'Máquina', 'Technogym / Gym80'],
    ['Climb', 'Pierna', 'Máquina', 'Technogym', true],
    ['Delt', 'Hombro', 'Máquina', 'Technogym'],
    ['Glute Drive', 'Glúteo', 'Máquina', 'Nautilus / Hammer Strength'],
    ['Hack Squat', 'Pierna', 'Máquina', 'Gym80'],
    ['Iso Lateral (todas las variantes)', 'Espalda', 'Máquina', 'Hammer Strength / Gym80'],
    ['Lat Pulldown', 'Espalda', 'Polea', 'Technogym'],
    ['Lateral Raise', 'Hombro', 'Máquina', 'Technogym'],
    ['Leg Curl', 'Pierna', 'Máquina', 'Technogym'],
    ['Leg Extension', 'Pierna', 'Máquina', 'Technogym'],
    ['Leg Press', 'Pierna', 'Máquina', 'Technogym'],
    ['Leg Press Pure Strength', 'Pierna', 'Máquina', 'Technogym'],
    ['Low Row', 'Espalda', 'Máquina', 'Technogym'],
    ['Pectoral Fly', 'Pecho', 'Máquina', 'Technogym'],
    ['Pendulum Squat', 'Pierna', 'Máquina', 'Gym80'],
    ['Prone Leg Curl', 'Pierna', 'Máquina', 'Technogym'],
    ['Rower', 'Espalda', 'Máquina', 'Concept2', true],
    ['Seated Cable Row', 'Espalda', 'Polea', 'Technogym'],
    ['Shoulder Press', 'Hombro', 'Máquina', 'Technogym'],
    ['Shoulder Press Plate Loaded', 'Hombro', 'Máquina', 'Hammer Strength / Gym80'],
    ['SkiErg', 'Espalda', 'Máquina', 'Concept2', true],
    ['Skillmill', 'Pierna', 'Máquina', 'Technogym', true],
    ['Split Squat Machine', 'Pierna', 'Máquina', 'Gym80'],
    ['Standing Shoulder Raise', 'Hombro', 'Máquina', 'Technogym'],
    ['Synchro', 'Pierna', 'Máquina', 'Technogym', true],
    ['T-Bar Row', 'Espalda', 'Máquina', 'Hammer Strength / Gym80'],
    ['Total Abdominal', 'Abdomen', 'Máquina', 'Technogym'],
    ['Triceps Machine', 'Tríceps', 'Máquina', 'Technogym'],
    ['Upper Back', 'Espalda', 'Máquina', 'Technogym'],
    ['V Squat', 'Pierna', 'Máquina', 'Gym80 / Hammer Strength'],
    ['Vertical Leg Press', 'Pierna', 'Máquina', 'Gym80'],
    ['Vertical Traction', 'Espalda', 'Máquina', 'Technogym'],
    ['Wide Chest Press', 'Pecho', 'Máquina', 'Hammer Strength / Gym80']
];

/** Los músculos que acompañan, para que el mapa del cuerpo no salga en blanco. */
const SECUNDARIOS = {
    'Pecho': ['Tríceps', 'Hombro'],
    'Espalda': ['Bíceps'],
    'Pierna': ['Glúteo'],
    'Glúteo': ['Pierna'],
    'Hombro': ['Tríceps'],
    'Bíceps': [],
    'Tríceps': [],
    'Abdomen': []
};

const comoDocumentos = () => MAQUINAS.map(([name, muscle, equipmentGroup, marca, isCardio]) => ({
    name,
    muscle,
    equipmentGroup,
    equipment: equipmentGroup,
    marca,
    gimnasios: [GIMNASIO],
    secondary: SECUNDARIOS[muscle] || [],
    isCardio: !!isCardio,
    category: isCardio ? 'cardio' : 'strength',
    // NO son `isCore`: el catálogo de siempre se queda como está, y estas salen
    // al pedir el filtro de su gimnasio o al buscarlas por nombre.
    isCore: false,
    isCustom: false,
    user: null
}));

module.exports = { GIMNASIO, MAQUINAS, comoDocumentos };
