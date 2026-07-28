/**
 * CATÁLOGO BASE DE EJERCICIOS
 *
 * Antes solo había 8 ejercicios escritos a mano dentro de `seedExercises`, sin
 * equipamiento útil ni músculos secundarios. Aquí está el catálogo completo,
 * separado del controlador para poder ampliarlo sin tocar la lógica.
 *
 * Campos:
 *  - muscle:       grupo principal (uno de los 8 de utils/muscles.js)
 *  - muscleDetail: músculo concreto (se ve en modo PRO)
 *  - secondary:    otros GRUPOS que participan (para pintar el cuerpo)
 *  - equipment:    con qué se hace
 *  - isCardio:     los de cardio puntúan por duración, no por kg
 */

const EXERCISE_CATALOG = [
    // ================= PECHO =================
    { name: 'Press de Banca', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps', 'Hombro'], equipment: 'Barra' },
    { name: 'Press Inclinado con Barra', muscle: 'Pecho', muscleDetail: 'Pectoral superior', secondary: ['Hombro', 'Tríceps'], equipment: 'Barra' },
    { name: 'Press Declinado', muscle: 'Pecho', muscleDetail: 'Pectoral inferior', secondary: ['Tríceps'], equipment: 'Barra' },
    { name: 'Press de Banca con Mancuernas', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps', 'Hombro'], equipment: 'Mancuernas' },
    { name: 'Press Inclinado con Mancuernas', muscle: 'Pecho', muscleDetail: 'Pectoral superior', secondary: ['Hombro'], equipment: 'Mancuernas' },
    { name: 'Aperturas con Mancuernas', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: [], equipment: 'Mancuernas' },
    { name: 'Contractor de Pecho', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: [], equipment: 'Máquina' },
    { name: 'Cruce de Poleas', muscle: 'Pecho', muscleDetail: 'Pectoral inferior', secondary: [], equipment: 'Polea' },
    { name: 'Flexiones', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps', 'Abdomen'], equipment: 'Peso Corporal' },
    { name: 'Fondos en Paralelas', muscle: 'Pecho', muscleDetail: 'Pectoral inferior', secondary: ['Tríceps', 'Hombro'], equipment: 'Peso Corporal' },
    { name: 'Pullover', muscle: 'Pecho', muscleDetail: 'Serrato anterior', secondary: ['Espalda'], equipment: 'Mancuernas' },

    // ================= ESPALDA =================
    { name: 'Dominadas', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Peso Corporal' },
    { name: 'Jalón al Pecho', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Polea' },
    { name: 'Remo con Barra', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps', 'Hombro'], equipment: 'Barra' },
    { name: 'Remo con Mancuerna', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Mancuernas' },
    { name: 'Remo en Polea Baja', muscle: 'Espalda', muscleDetail: 'Romboides', secondary: ['Bíceps'], equipment: 'Polea' },
    { name: 'Remo en Máquina', muscle: 'Espalda', muscleDetail: 'Romboides', secondary: ['Bíceps'], equipment: 'Máquina' },
    { name: 'Peso Muerto', muscle: 'Espalda', muscleDetail: 'Lumbar', secondary: ['Pierna', 'Glúteo'], equipment: 'Barra' },
    { name: 'Peso Muerto Rumano', muscle: 'Espalda', muscleDetail: 'Lumbar', secondary: ['Pierna', 'Glúteo'], equipment: 'Barra' },
    { name: 'Encogimientos de Hombros', muscle: 'Espalda', muscleDetail: 'Trapecio superior', secondary: [], equipment: 'Mancuernas' },
    { name: 'Face Pull', muscle: 'Espalda', muscleDetail: 'Trapecio medio', secondary: ['Hombro'], equipment: 'Polea' },
    { name: 'Hiperextensiones', muscle: 'Espalda', muscleDetail: 'Lumbar', secondary: ['Glúteo'], equipment: 'Peso Corporal' },
    { name: 'Pull-over en Polea', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: [], equipment: 'Polea' },

    // ================= HOMBRO =================
    { name: 'Press Militar', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: ['Tríceps'], equipment: 'Barra' },
    { name: 'Press de Hombro con Mancuernas', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: ['Tríceps'], equipment: 'Mancuernas' },
    { name: 'Press Arnold', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: ['Tríceps'], equipment: 'Mancuernas' },
    { name: 'Elevaciones Laterales', muscle: 'Hombro', muscleDetail: 'Deltoides lateral', secondary: [], equipment: 'Mancuernas' },
    { name: 'Elevaciones Frontales', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: [], equipment: 'Mancuernas' },
    { name: 'Pájaros (Deltoide Posterior)', muscle: 'Hombro', muscleDetail: 'Deltoides posterior', secondary: ['Espalda'], equipment: 'Mancuernas' },
    { name: 'Elevaciones Laterales en Polea', muscle: 'Hombro', muscleDetail: 'Deltoides lateral', secondary: [], equipment: 'Polea' },
    { name: 'Remo al Mentón', muscle: 'Hombro', muscleDetail: 'Deltoides lateral', secondary: ['Espalda'], equipment: 'Barra' },
    { name: 'Rotación Externa', muscle: 'Hombro', muscleDetail: 'Manguito rotador', secondary: [], equipment: 'Polea' },

    // ================= BÍCEPS =================
    { name: 'Curl de Bíceps con Barra', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Barra' },
    { name: 'Curl con Mancuernas', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza larga)', secondary: [], equipment: 'Mancuernas' },
    { name: 'Curl Martillo', muscle: 'Bíceps', muscleDetail: 'Braquiorradial', secondary: [], equipment: 'Mancuernas' },
    { name: 'Curl Concentrado', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Mancuernas' },
    { name: 'Curl Predicador', muscle: 'Bíceps', muscleDetail: 'Braquial anterior', secondary: [], equipment: 'Barra' },
    { name: 'Curl en Polea', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Polea' },
    { name: 'Curl Inclinado', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza larga)', secondary: [], equipment: 'Mancuernas' },

    // ================= TRÍCEPS =================
    { name: 'Press Francés', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza larga)', secondary: [], equipment: 'Barra' },
    { name: 'Extensión en Polea', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza lateral)', secondary: [], equipment: 'Polea' },
    { name: 'Extensión sobre la Cabeza', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza larga)', secondary: [], equipment: 'Mancuernas' },
    { name: 'Fondos en Banco', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza medial)', secondary: ['Pecho'], equipment: 'Peso Corporal' },
    { name: 'Press Cerrado', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza medial)', secondary: ['Pecho'], equipment: 'Barra' },
    { name: 'Patada de Tríceps', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza lateral)', secondary: [], equipment: 'Mancuernas' },

    // ================= PIERNA =================
    { name: 'Sentadilla', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: ['Glúteo', 'Abdomen'], equipment: 'Barra' },
    { name: 'Sentadilla Frontal', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto medial)', secondary: ['Glúteo', 'Abdomen'], equipment: 'Barra' },
    { name: 'Prensa de Piernas', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto lateral)', secondary: ['Glúteo'], equipment: 'Máquina' },
    { name: 'Extensión de Cuádriceps', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: [], equipment: 'Máquina' },
    { name: 'Curl Femoral Tumbado', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: [], equipment: 'Máquina' },
    { name: 'Curl Femoral Sentado', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: [], equipment: 'Máquina' },
    { name: 'Zancadas', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto medial)', secondary: ['Glúteo'], equipment: 'Mancuernas' },
    { name: 'Sentadilla Búlgara', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto medial)', secondary: ['Glúteo'], equipment: 'Mancuernas' },
    { name: 'Hack Squat', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto lateral)', secondary: ['Glúteo'], equipment: 'Máquina' },
    { name: 'Elevación de Gemelos de Pie', muscle: 'Pierna', muscleDetail: 'Gemelos', secondary: [], equipment: 'Máquina' },
    { name: 'Elevación de Gemelos Sentado', muscle: 'Pierna', muscleDetail: 'Sóleo', secondary: [], equipment: 'Máquina' },
    { name: 'Aductores en Máquina', muscle: 'Pierna', muscleDetail: 'Aductores', secondary: [], equipment: 'Máquina' },
    { name: 'Abductores en Máquina', muscle: 'Pierna', muscleDetail: 'Abductores', secondary: ['Glúteo'], equipment: 'Máquina' },
    { name: 'Peso Muerto Piernas Rígidas', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: ['Glúteo', 'Espalda'], equipment: 'Barra' },

    // ================= GLÚTEO =================
    { name: 'Hip Thrust', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: ['Pierna'], equipment: 'Barra' },
    { name: 'Puente de Glúteo', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: [], equipment: 'Peso Corporal' },
    { name: 'Patada de Glúteo en Polea', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: [], equipment: 'Polea' },
    { name: 'Abducción de Cadera', muscle: 'Glúteo', muscleDetail: 'Glúteo medio', secondary: [], equipment: 'Máquina' },
    { name: 'Peso Muerto Sumo', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: ['Pierna', 'Espalda'], equipment: 'Barra' },
    { name: 'Step Up', muscle: 'Glúteo', muscleDetail: 'Glúteo medio', secondary: ['Pierna'], equipment: 'Mancuernas' },

    // ================= ABDOMEN =================
    { name: 'Plancha', muscle: 'Abdomen', muscleDetail: 'Transverso abdominal', secondary: [], equipment: 'Peso Corporal' },
    { name: 'Crunch Abdominal', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (superior)', secondary: [], equipment: 'Peso Corporal' },
    { name: 'Elevación de Piernas', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (inferior)', secondary: [], equipment: 'Peso Corporal' },
    { name: 'Giro Ruso', muscle: 'Abdomen', muscleDetail: 'Oblicuos', secondary: [], equipment: 'Mancuernas' },
    { name: 'Rueda Abdominal', muscle: 'Abdomen', muscleDetail: 'Transverso abdominal', secondary: ['Espalda'], equipment: 'Accesorio' },
    { name: 'Crunch en Polea', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (superior)', secondary: [], equipment: 'Polea' },
    { name: 'Elevación de Rodillas en Paralelas', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (inferior)', secondary: [], equipment: 'Peso Corporal' },
    { name: 'Plancha Lateral', muscle: 'Abdomen', muscleDetail: 'Oblicuos', secondary: [], equipment: 'Peso Corporal' },

    // ================= CARDIO =================
    // Puntúan por duración, no por kg levantados
    { name: 'Cinta de Correr', muscle: 'Pierna', muscleDetail: '', secondary: [], equipment: 'Máquina', isCardio: true },
    { name: 'Bicicleta Estática', muscle: 'Pierna', muscleDetail: '', secondary: ['Glúteo'], equipment: 'Máquina', isCardio: true },
    { name: 'Elíptica', muscle: 'Pierna', muscleDetail: '', secondary: ['Espalda'], equipment: 'Máquina', isCardio: true },
    { name: 'Remo (Máquina)', muscle: 'Espalda', muscleDetail: '', secondary: ['Pierna', 'Bíceps'], equipment: 'Máquina', isCardio: true },
    { name: 'Comba', muscle: 'Pierna', muscleDetail: '', secondary: [], equipment: 'Accesorio', isCardio: true },
    { name: 'Escaladora', muscle: 'Glúteo', muscleDetail: '', secondary: ['Pierna'], equipment: 'Máquina', isCardio: true },
    { name: 'Burpees', muscle: 'Pecho', muscleDetail: '', secondary: ['Pierna', 'Abdomen'], equipment: 'Peso Corporal', isCardio: true },
    { name: 'Battle Ropes', muscle: 'Hombro', muscleDetail: '', secondary: ['Abdomen'], equipment: 'Accesorio', isCardio: true },
    { name: 'Sprint', muscle: 'Pierna', muscleDetail: '', secondary: ['Glúteo'], equipment: 'Peso Corporal', isCardio: true }
];

module.exports = { EXERCISE_CATALOG };
