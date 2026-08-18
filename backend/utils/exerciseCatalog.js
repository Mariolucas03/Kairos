/**
 * CATÁLOGO BASE DE EJERCICIOS
 *
 * Antes solo había 8 ejercicios escritos a mano dentro de `seedExercises`, sin
 * equipamiento útil ni músculos secundarios. Aquí está el catálogo completo,
 * separado del controlador para poder ampliarlo sin tocar la lógica.
 *
 * Campos:
 *  - muscle:       grupo principal (uno de los 8 de utils/muscles.js)
 *  - muscleDetail: músculo concreto
 *  - secondary:    otros GRUPOS que participan (para pintar el cuerpo)
 *  - shares:       reparto del esfuerzo en % por músculo concreto (suma 100)
 *  - equipment:    con qué se hace
 *  - isCardio:     los de cardio puntúan por duración, no por kg
 *
 * SOBRE `shares`
 * ==============
 * Es lo que hace que una sentadilla no sume lo mismo al cuádriceps que al
 * lumbar. Cada músculo se lleva su porcentaje del volumen de la serie, y su
 * grupo padre acumula esa misma parte, así el ranking por grupos sigue cuadrando.
 * Los nombres son EXACTAMENTE los de utils/muscles.js (SPECIFIC_MUSCLES).
 *
 * Los porcentajes son de esfuerzo relativo con criterio de gimnasio, no de
 * electromiografía: sirven para que el mapa del cuerpo se coloree de forma
 * reconocible y para que suba de rango el músculo que de verdad has trabajado.
 *
 * Si un ejercicio no trae `shares` se usa el reparto antiguo (principal 100%,
 * cada secundario 40%), así que nada se rompe por no tenerlo.
 *
 * ⚠️ NO RENOMBRAR ejercicios existentes: los entrenos guardados se relacionan
 * con su ejercicio POR NOMBRE. Cambiar un nombre deja huérfano el histórico.
 */

const EXERCISE_CATALOG = [
    // ================= PECHO =================
    { name: 'Press de Banca', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps', 'Hombro'], equipment: 'Barra', shares: { 'Pectoral medio': 55, 'Pectoral inferior': 10, 'Tríceps (cabeza lateral)': 20, 'Deltoides anterior': 15 } },
    { name: 'Press Inclinado con Barra', muscle: 'Pecho', muscleDetail: 'Pectoral superior', secondary: ['Hombro', 'Tríceps'], equipment: 'Barra', shares: { 'Pectoral superior': 55, 'Pectoral medio': 10, 'Deltoides anterior': 20, 'Tríceps (cabeza lateral)': 15 } },
    { name: 'Press Declinado', muscle: 'Pecho', muscleDetail: 'Pectoral inferior', secondary: ['Tríceps'], equipment: 'Barra', shares: { 'Pectoral inferior': 60, 'Pectoral medio': 15, 'Tríceps (cabeza lateral)': 25 } },
    { name: 'Press de Banca con Mancuernas', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps', 'Hombro'], equipment: 'Mancuernas', shares: { 'Pectoral medio': 55, 'Pectoral inferior': 10, 'Deltoides anterior': 15, 'Tríceps (cabeza lateral)': 20 } },
    { name: 'Press Inclinado con Mancuernas', muscle: 'Pecho', muscleDetail: 'Pectoral superior', secondary: ['Hombro'], equipment: 'Mancuernas', shares: { 'Pectoral superior': 60, 'Pectoral medio': 10, 'Deltoides anterior': 20, 'Tríceps (cabeza lateral)': 10 } },
    { name: 'Aperturas con Mancuernas', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: [], equipment: 'Mancuernas', shares: { 'Pectoral medio': 75, 'Pectoral superior': 15, 'Deltoides anterior': 10 } },
    { name: 'Cruce de Poleas', muscle: 'Pecho', muscleDetail: 'Pectoral inferior', secondary: [], equipment: 'Polea', shares: { 'Pectoral inferior': 55, 'Pectoral medio': 35, 'Deltoides anterior': 10 } },
    { name: 'Flexiones', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps', 'Abdomen'], equipment: 'Peso Corporal', shares: { 'Pectoral medio': 50, 'Tríceps (cabeza lateral)': 20, 'Deltoides anterior': 15, 'Recto abdominal (superior)': 15 } },
    { name: 'Fondos en Paralelas', muscle: 'Pecho', muscleDetail: 'Pectoral inferior', secondary: ['Tríceps', 'Hombro'], equipment: 'Peso Corporal', shares: { 'Pectoral inferior': 45, 'Tríceps (cabeza larga)': 30, 'Tríceps (cabeza lateral)': 15, 'Deltoides anterior': 10 } },
    { name: 'Pullover', muscle: 'Pecho', muscleDetail: 'Serrato anterior', secondary: ['Espalda'], equipment: 'Mancuernas', shares: { 'Serrato anterior': 35, 'Pectoral superior': 20, 'Dorsal ancho': 30, 'Tríceps (cabeza larga)': 15 } },
    // Nuevos
    { name: 'Aperturas Inclinadas', muscle: 'Pecho', muscleDetail: 'Pectoral superior', secondary: [], equipment: 'Mancuernas', shares: { 'Pectoral superior': 70, 'Pectoral medio': 20, 'Deltoides anterior': 10 } },
    { name: 'Press de Pecho en Máquina', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps'], equipment: 'Máquina', shares: { 'Pectoral medio': 65, 'Pectoral inferior': 10, 'Tríceps (cabeza lateral)': 25 } },
    { name: 'Press Inclinado en Máquina', muscle: 'Pecho', muscleDetail: 'Pectoral superior', secondary: ['Tríceps'], equipment: 'Máquina', shares: { 'Pectoral superior': 65, 'Deltoides anterior': 15, 'Tríceps (cabeza lateral)': 20 } },
    { name: 'Flexiones Diamante', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps'], equipment: 'Peso Corporal', shares: { 'Tríceps (cabeza lateral)': 45, 'Tríceps (cabeza larga)': 15, 'Pectoral medio': 40 } },
    { name: 'Flexiones Declinadas', muscle: 'Pecho', muscleDetail: 'Pectoral superior', secondary: ['Tríceps', 'Hombro'], equipment: 'Peso Corporal', shares: { 'Pectoral superior': 50, 'Deltoides anterior': 20, 'Tríceps (cabeza lateral)': 20, 'Recto abdominal (superior)': 10 } },
    { name: 'Press con Banda Elástica', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps'], equipment: 'Accesorio', shares: { 'Pectoral medio': 60, 'Tríceps (cabeza lateral)': 25, 'Deltoides anterior': 15 } },
    { name: 'Pullover en Máquina', muscle: 'Pecho', muscleDetail: 'Serrato anterior', secondary: ['Espalda'], equipment: 'Máquina', shares: { 'Serrato anterior': 30, 'Dorsal ancho': 40, 'Pectoral superior': 20, 'Tríceps (cabeza larga)': 10 } },

    // ================= ESPALDA =================
    { name: 'Dominadas', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps', 'Hombro'], equipment: 'Peso Corporal', shares: { 'Dorsal ancho': 50, 'Redondo mayor': 15, 'Trapecio medio': 10, 'Bíceps braquial (cabeza larga)': 15, 'Braquial anterior': 10 } },
    { name: 'Jalón al Pecho', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Polea', shares: { 'Dorsal ancho': 55, 'Redondo mayor': 15, 'Trapecio medio': 10, 'Bíceps braquial (cabeza larga)': 20 } },
    { name: 'Remo con Barra', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps', 'Hombro'], equipment: 'Barra', shares: { 'Dorsal ancho': 35, 'Romboides': 20, 'Trapecio medio': 20, 'Bíceps braquial (cabeza larga)': 15, 'Lumbar': 10 } },
    { name: 'Remo con Mancuerna', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Mancuernas', shares: { 'Dorsal ancho': 45, 'Redondo mayor': 20, 'Romboides': 15, 'Bíceps braquial (cabeza larga)': 20 } },
    { name: 'Remo en Polea Baja', muscle: 'Espalda', muscleDetail: 'Romboides', secondary: ['Bíceps'], equipment: 'Polea', shares: { 'Romboides': 30, 'Trapecio medio': 25, 'Dorsal ancho': 30, 'Bíceps braquial (cabeza larga)': 15 } },
    { name: 'Remo en Máquina', muscle: 'Espalda', muscleDetail: 'Romboides', secondary: ['Bíceps'], equipment: 'Máquina', shares: { 'Romboides': 30, 'Trapecio medio': 25, 'Dorsal ancho': 30, 'Bíceps braquial (cabeza larga)': 15 } },
    { name: 'Peso Muerto', muscle: 'Espalda', muscleDetail: 'Lumbar', secondary: ['Pierna', 'Glúteo'], equipment: 'Barra', shares: { 'Lumbar': 25, 'Glúteo mayor': 25, 'Isquiotibiales': 25, 'Trapecio superior': 10, 'Dorsal ancho': 10, 'Cuádriceps (recto femoral)': 5 } },
    { name: 'Peso Muerto Rumano', muscle: 'Espalda', muscleDetail: 'Lumbar', secondary: ['Pierna', 'Glúteo'], equipment: 'Barra', shares: { 'Isquiotibiales': 45, 'Glúteo mayor': 25, 'Lumbar': 25, 'Trapecio superior': 5 } },
    { name: 'Encogimientos de Hombros', muscle: 'Espalda', muscleDetail: 'Trapecio superior', secondary: [], equipment: 'Mancuernas', shares: { 'Trapecio superior': 85, 'Trapecio medio': 15 } },
    { name: 'Hiperextensiones', muscle: 'Espalda', muscleDetail: 'Lumbar', secondary: ['Glúteo'], equipment: 'Peso Corporal', shares: { 'Lumbar': 55, 'Glúteo mayor': 25, 'Isquiotibiales': 20 } },
    { name: 'Pull-over en Polea', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: [], equipment: 'Polea', shares: { 'Dorsal ancho': 65, 'Redondo mayor': 20, 'Tríceps (cabeza larga)': 15 } },
    // Nuevos
    { name: 'Dominadas Supinas', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Peso Corporal', shares: { 'Dorsal ancho': 40, 'Bíceps braquial (cabeza corta)': 30, 'Bíceps braquial (cabeza larga)': 15, 'Redondo mayor': 15 } },
    { name: 'Dominadas Neutras', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Peso Corporal', shares: { 'Dorsal ancho': 45, 'Braquial anterior': 20, 'Redondo mayor': 20, 'Bíceps braquial (cabeza larga)': 15 } },
    { name: 'Dominadas Lastradas', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Peso Corporal', shares: { 'Dorsal ancho': 50, 'Redondo mayor': 20, 'Bíceps braquial (cabeza larga)': 20, 'Trapecio medio': 10 } },
    { name: 'Jalón Agarre Cerrado', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Polea', shares: { 'Dorsal ancho': 50, 'Redondo mayor': 10, 'Bíceps braquial (cabeza corta)': 25, 'Braquial anterior': 15 } },
    { name: 'Jalón Tras Nuca', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Hombro'], equipment: 'Polea', shares: { 'Dorsal ancho': 50, 'Trapecio medio': 20, 'Redondo mayor': 20, 'Deltoides posterior': 10 } },
    { name: 'Remo Pendlay', muscle: 'Espalda', muscleDetail: 'Trapecio medio', secondary: ['Bíceps'], equipment: 'Barra', shares: { 'Trapecio medio': 30, 'Romboides': 25, 'Dorsal ancho': 25, 'Lumbar': 10, 'Bíceps braquial (cabeza larga)': 10 } },
    { name: 'Remo en T', muscle: 'Espalda', muscleDetail: 'Trapecio medio', secondary: ['Bíceps'], equipment: 'Máquina', shares: { 'Trapecio medio': 30, 'Dorsal ancho': 30, 'Romboides': 25, 'Bíceps braquial (cabeza larga)': 15 } },
    { name: 'Remo Invertido', muscle: 'Espalda', muscleDetail: 'Trapecio medio', secondary: ['Bíceps'], equipment: 'Peso Corporal', shares: { 'Trapecio medio': 30, 'Romboides': 25, 'Dorsal ancho': 25, 'Bíceps braquial (cabeza larga)': 20 } },
    { name: 'Remo a una Mano en Polea', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Polea', shares: { 'Dorsal ancho': 50, 'Redondo mayor': 20, 'Romboides': 15, 'Bíceps braquial (cabeza larga)': 15 } },
    { name: 'Buenos Días', muscle: 'Espalda', muscleDetail: 'Lumbar', secondary: ['Pierna'], equipment: 'Barra', shares: { 'Lumbar': 40, 'Isquiotibiales': 40, 'Glúteo mayor': 20 } },
    { name: 'Encogimientos con Barra', muscle: 'Espalda', muscleDetail: 'Trapecio superior', secondary: [], equipment: 'Barra', shares: { 'Trapecio superior': 85, 'Trapecio medio': 15 } },

    // ================= HOMBRO =================
    { name: 'Press Militar', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: ['Tríceps', 'Pecho'], equipment: 'Barra', shares: { 'Deltoides anterior': 45, 'Deltoides lateral': 20, 'Tríceps (cabeza lateral)': 20, 'Pectoral superior': 10, 'Trapecio superior': 5 } },
    { name: 'Press de Hombro con Mancuernas', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: ['Tríceps', 'Pecho'], equipment: 'Mancuernas', shares: { 'Deltoides anterior': 45, 'Deltoides lateral': 25, 'Tríceps (cabeza lateral)': 20, 'Trapecio superior': 10 } },
    { name: 'Press Arnold', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: ['Tríceps', 'Pecho'], equipment: 'Mancuernas', shares: { 'Deltoides anterior': 40, 'Deltoides lateral': 30, 'Tríceps (cabeza lateral)': 20, 'Manguito rotador': 10 } },
    { name: 'Elevaciones Laterales', muscle: 'Hombro', muscleDetail: 'Deltoides lateral', secondary: [], equipment: 'Mancuernas', shares: { 'Deltoides lateral': 80, 'Deltoides anterior': 10, 'Trapecio superior': 10 } },
    { name: 'Elevaciones Frontales', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: [], equipment: 'Mancuernas', shares: { 'Deltoides anterior': 80, 'Pectoral superior': 10, 'Deltoides lateral': 10 } },
    { name: 'Pájaros (Deltoide Posterior)', muscle: 'Hombro', muscleDetail: 'Deltoides posterior', secondary: ['Espalda'], equipment: 'Mancuernas', shares: { 'Deltoides posterior': 65, 'Trapecio medio': 20, 'Romboides': 15 } },
    { name: 'Elevaciones Laterales en Polea', muscle: 'Hombro', muscleDetail: 'Deltoides lateral', secondary: [], equipment: 'Polea', shares: { 'Deltoides lateral': 85, 'Trapecio superior': 15 } },
    { name: 'Remo al Mentón', muscle: 'Hombro', muscleDetail: 'Deltoides lateral', secondary: ['Espalda'], equipment: 'Barra', shares: { 'Deltoides lateral': 45, 'Trapecio superior': 30, 'Deltoides anterior': 15, 'Bíceps braquial (cabeza corta)': 10 } },
    { name: 'Rotación Externa', muscle: 'Hombro', muscleDetail: 'Manguito rotador', secondary: [], equipment: 'Polea', shares: { 'Manguito rotador': 80, 'Deltoides posterior': 20 } },
    // Nuevos
    { name: 'Press de Hombro en Máquina', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: ['Tríceps'], equipment: 'Máquina', shares: { 'Deltoides anterior': 50, 'Deltoides lateral': 25, 'Tríceps (cabeza lateral)': 25 } },
    { name: 'Pájaros en Máquina', muscle: 'Hombro', muscleDetail: 'Deltoides posterior', secondary: ['Espalda'], equipment: 'Máquina', shares: { 'Deltoides posterior': 70, 'Trapecio medio': 20, 'Romboides': 10 } },
    { name: 'Pájaros en Polea', muscle: 'Hombro', muscleDetail: 'Deltoides posterior', secondary: ['Espalda'], equipment: 'Polea', shares: { 'Deltoides posterior': 70, 'Trapecio medio': 20, 'Romboides': 10 } },
    { name: 'Rotación Interna en Polea', muscle: 'Hombro', muscleDetail: 'Manguito rotador', secondary: [], equipment: 'Polea', shares: { 'Manguito rotador': 85, 'Deltoides anterior': 15 } },
    { name: 'Elevación Lateral en Máquina', muscle: 'Hombro', muscleDetail: 'Deltoides lateral', secondary: [], equipment: 'Máquina', shares: { 'Deltoides lateral': 85, 'Trapecio superior': 15 } },

    // ================= BÍCEPS =================
    { name: 'Curl de Bíceps con Barra', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Barra', shares: { 'Bíceps braquial (cabeza corta)': 45, 'Bíceps braquial (cabeza larga)': 35, 'Braquial anterior': 20 } },
    { name: 'Curl con Mancuernas', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza larga)', secondary: [], equipment: 'Mancuernas', shares: { 'Bíceps braquial (cabeza larga)': 45, 'Bíceps braquial (cabeza corta)': 35, 'Braquial anterior': 20 } },
    { name: 'Curl Martillo', muscle: 'Bíceps', muscleDetail: 'Braquiorradial', secondary: [], equipment: 'Mancuernas', shares: { 'Braquiorradial': 45, 'Braquial anterior': 30, 'Bíceps braquial (cabeza larga)': 25 } },
    { name: 'Curl Concentrado', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Mancuernas', shares: { 'Bíceps braquial (cabeza corta)': 60, 'Bíceps braquial (cabeza larga)': 25, 'Braquial anterior': 15 } },
    { name: 'Curl Predicador', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Barra', shares: { 'Bíceps braquial (cabeza corta)': 55, 'Braquial anterior': 30, 'Bíceps braquial (cabeza larga)': 15 } },
    { name: 'Curl en Polea', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Polea', shares: { 'Bíceps braquial (cabeza corta)': 45, 'Bíceps braquial (cabeza larga)': 35, 'Braquial anterior': 20 } },
    { name: 'Curl Inclinado', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza larga)', secondary: [], equipment: 'Mancuernas', shares: { 'Bíceps braquial (cabeza larga)': 65, 'Bíceps braquial (cabeza corta)': 20, 'Braquial anterior': 15 } },
    // Nuevos
    { name: 'Curl Araña', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Mancuernas', shares: { 'Bíceps braquial (cabeza corta)': 60, 'Braquial anterior': 25, 'Bíceps braquial (cabeza larga)': 15 } },
    { name: 'Curl con Barra Z', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Barra', shares: { 'Bíceps braquial (cabeza corta)': 45, 'Bíceps braquial (cabeza larga)': 30, 'Braquiorradial': 25 } },
    { name: 'Curl Martillo en Polea', muscle: 'Bíceps', muscleDetail: 'Braquiorradial', secondary: [], equipment: 'Polea', shares: { 'Braquiorradial': 45, 'Braquial anterior': 30, 'Bíceps braquial (cabeza larga)': 25 } },
    { name: 'Curl Invertido', muscle: 'Bíceps', muscleDetail: 'Braquiorradial', secondary: [], equipment: 'Barra', shares: { 'Braquiorradial': 55, 'Braquial anterior': 30, 'Bíceps braquial (cabeza corta)': 15 } },
    { name: 'Curl en Máquina', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Máquina', shares: { 'Bíceps braquial (cabeza corta)': 50, 'Braquial anterior': 30, 'Bíceps braquial (cabeza larga)': 20 } },

    // ================= TRÍCEPS =================
    { name: 'Press Francés', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza larga)', secondary: [], equipment: 'Barra', shares: { 'Tríceps (cabeza larga)': 55, 'Tríceps (cabeza lateral)': 25, 'Tríceps (cabeza medial)': 20 } },
    { name: 'Extensión en Polea', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza lateral)', secondary: [], equipment: 'Polea', shares: { 'Tríceps (cabeza lateral)': 50, 'Tríceps (cabeza medial)': 30, 'Tríceps (cabeza larga)': 20 } },
    { name: 'Extensión sobre la Cabeza', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza larga)', secondary: [], equipment: 'Mancuernas', shares: { 'Tríceps (cabeza larga)': 65, 'Tríceps (cabeza lateral)': 20, 'Tríceps (cabeza medial)': 15 } },
    { name: 'Fondos en Banco', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza medial)', secondary: ['Pecho'], equipment: 'Peso Corporal', shares: { 'Tríceps (cabeza medial)': 35, 'Tríceps (cabeza lateral)': 30, 'Tríceps (cabeza larga)': 20, 'Pectoral inferior': 15 } },
    { name: 'Press Cerrado', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza lateral)', secondary: ['Pecho'], equipment: 'Barra', shares: { 'Tríceps (cabeza lateral)': 35, 'Tríceps (cabeza medial)': 25, 'Tríceps (cabeza larga)': 15, 'Pectoral medio': 25 } },
    { name: 'Patada de Tríceps', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza lateral)', secondary: [], equipment: 'Mancuernas', shares: { 'Tríceps (cabeza lateral)': 55, 'Tríceps (cabeza larga)': 30, 'Tríceps (cabeza medial)': 15 } },
    // Nuevos
    { name: 'Extensión con Cuerda', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza lateral)', secondary: [], equipment: 'Polea', shares: { 'Tríceps (cabeza lateral)': 45, 'Tríceps (cabeza medial)': 35, 'Tríceps (cabeza larga)': 20 } },
    { name: 'Extensión sobre la Cabeza en Polea', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza larga)', secondary: [], equipment: 'Polea', shares: { 'Tríceps (cabeza larga)': 65, 'Tríceps (cabeza lateral)': 20, 'Tríceps (cabeza medial)': 15 } },
    { name: 'Press Francés con Mancuernas', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza larga)', secondary: [], equipment: 'Mancuernas', shares: { 'Tríceps (cabeza larga)': 60, 'Tríceps (cabeza lateral)': 25, 'Tríceps (cabeza medial)': 15 } },
    { name: 'Extensión a una Mano', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza lateral)', secondary: [], equipment: 'Polea', shares: { 'Tríceps (cabeza lateral)': 55, 'Tríceps (cabeza medial)': 30, 'Tríceps (cabeza larga)': 15 } },

    // ================= PIERNA =================
    { name: 'Sentadilla', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: ['Glúteo', 'Espalda'], equipment: 'Barra', shares: { 'Cuádriceps (recto femoral)': 25, 'Cuádriceps (vasto lateral)': 20, 'Cuádriceps (vasto medial)': 15, 'Glúteo mayor': 25, 'Isquiotibiales': 5, 'Lumbar': 10 } },
    { name: 'Sentadilla Frontal', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: ['Glúteo', 'Abdomen'], equipment: 'Barra', shares: { 'Cuádriceps (recto femoral)': 30, 'Cuádriceps (vasto lateral)': 20, 'Cuádriceps (vasto medial)': 20, 'Glúteo mayor': 15, 'Recto abdominal (superior)': 10, 'Lumbar': 5 } },
    { name: 'Prensa de Piernas', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto lateral)', secondary: ['Glúteo'], equipment: 'Máquina', shares: { 'Cuádriceps (vasto lateral)': 30, 'Cuádriceps (recto femoral)': 25, 'Cuádriceps (vasto medial)': 20, 'Glúteo mayor': 20, 'Isquiotibiales': 5 } },
    { name: 'Extensión de Cuádriceps', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: [], equipment: 'Máquina', shares: { 'Cuádriceps (recto femoral)': 40, 'Cuádriceps (vasto lateral)': 30, 'Cuádriceps (vasto medial)': 30 } },
    { name: 'Curl Femoral Tumbado', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: [], equipment: 'Máquina', shares: { 'Isquiotibiales': 85, 'Gemelos': 15 } },
    { name: 'Curl Femoral Sentado', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: [], equipment: 'Máquina', shares: { 'Isquiotibiales': 90, 'Gemelos': 10 } },
    { name: 'Zancadas', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto medial)', secondary: ['Glúteo'], equipment: 'Mancuernas', shares: { 'Cuádriceps (vasto medial)': 25, 'Cuádriceps (recto femoral)': 20, 'Glúteo mayor': 30, 'Glúteo medio': 15, 'Isquiotibiales': 10 } },
    { name: 'Sentadilla Búlgara', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto medial)', secondary: ['Glúteo'], equipment: 'Mancuernas', shares: { 'Cuádriceps (vasto medial)': 25, 'Cuádriceps (recto femoral)': 20, 'Glúteo mayor': 30, 'Glúteo medio': 15, 'Isquiotibiales': 10 } },
    { name: 'Hack Squat', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto lateral)', secondary: ['Glúteo'], equipment: 'Máquina', shares: { 'Cuádriceps (vasto lateral)': 35, 'Cuádriceps (recto femoral)': 25, 'Cuádriceps (vasto medial)': 25, 'Glúteo mayor': 15 } },
    { name: 'Elevación de Gemelos de Pie', muscle: 'Pierna', muscleDetail: 'Gemelos', secondary: [], equipment: 'Máquina', shares: { 'Gemelos': 80, 'Sóleo': 20 } },
    { name: 'Elevación de Gemelos Sentado', muscle: 'Pierna', muscleDetail: 'Sóleo', secondary: [], equipment: 'Máquina', shares: { 'Sóleo': 75, 'Gemelos': 25 } },
    { name: 'Aductores en Máquina', muscle: 'Pierna', muscleDetail: 'Aductores', secondary: [], equipment: 'Máquina', shares: { 'Aductores': 90, 'Cuádriceps (vasto medial)': 10 } },
    { name: 'Abductores en Máquina', muscle: 'Pierna', muscleDetail: 'Abductores', secondary: ['Glúteo'], equipment: 'Máquina', shares: { 'Abductores': 55, 'Glúteo medio': 35, 'Glúteo mayor': 10 } },
    { name: 'Peso Muerto Piernas Rígidas', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: ['Glúteo', 'Espalda'], equipment: 'Barra', shares: { 'Isquiotibiales': 50, 'Glúteo mayor': 25, 'Lumbar': 25 } },
    // Nuevos
    { name: 'Sentadilla Goblet', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: ['Glúteo'], equipment: 'Mancuernas', shares: { 'Cuádriceps (recto femoral)': 30, 'Cuádriceps (vasto medial)': 20, 'Glúteo mayor': 25, 'Aductores': 15, 'Recto abdominal (superior)': 10 } },
    { name: 'Sentadilla Sissy', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: [], equipment: 'Peso Corporal', shares: { 'Cuádriceps (recto femoral)': 45, 'Cuádriceps (vasto medial)': 30, 'Cuádriceps (vasto lateral)': 25 } },
    { name: 'Sentadilla en Multipower', muscle: 'Pierna', muscleDetail: 'Cuádriceps (vasto lateral)', secondary: ['Glúteo'], equipment: 'Máquina', shares: { 'Cuádriceps (vasto lateral)': 30, 'Cuádriceps (recto femoral)': 25, 'Cuádriceps (vasto medial)': 20, 'Glúteo mayor': 25 } },
    { name: 'Zancadas Caminando', muscle: 'Pierna', muscleDetail: 'Glúteo mayor', secondary: ['Glúteo'], equipment: 'Mancuernas', shares: { 'Glúteo mayor': 35, 'Cuádriceps (recto femoral)': 25, 'Cuádriceps (vasto medial)': 20, 'Isquiotibiales': 10, 'Glúteo medio': 10 } },
    { name: 'Curl Nórdico', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: ['Glúteo'], equipment: 'Peso Corporal', shares: { 'Isquiotibiales': 75, 'Glúteo mayor': 15, 'Lumbar': 10 } },
    { name: 'Peso Muerto a una Pierna', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: ['Glúteo', 'Espalda'], equipment: 'Mancuernas', shares: { 'Isquiotibiales': 40, 'Glúteo mayor': 30, 'Glúteo medio': 15, 'Lumbar': 15 } },
    { name: 'Elevación de Gemelos en Prensa', muscle: 'Pierna', muscleDetail: 'Gemelos', secondary: [], equipment: 'Máquina', shares: { 'Gemelos': 70, 'Sóleo': 30 } },
    { name: 'Elevación de Gemelos a una Pierna', muscle: 'Pierna', muscleDetail: 'Gemelos', secondary: [], equipment: 'Peso Corporal', shares: { 'Gemelos': 80, 'Sóleo': 20 } },
    { name: 'Sentadilla Sumo', muscle: 'Pierna', muscleDetail: 'Aductores', secondary: ['Glúteo'], equipment: 'Mancuernas', shares: { 'Aductores': 30, 'Glúteo mayor': 30, 'Cuádriceps (vasto medial)': 20, 'Cuádriceps (recto femoral)': 20 } },
    { name: 'Aductores en Polea', muscle: 'Pierna', muscleDetail: 'Aductores', secondary: [], equipment: 'Polea', shares: { 'Aductores': 90, 'Cuádriceps (vasto medial)': 10 } },

    // ================= GLÚTEO =================
    { name: 'Hip Thrust', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: ['Pierna'], equipment: 'Barra', shares: { 'Glúteo mayor': 65, 'Isquiotibiales': 20, 'Cuádriceps (recto femoral)': 10, 'Lumbar': 5 } },
    { name: 'Puente de Glúteo', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: ['Pierna'], equipment: 'Peso Corporal', shares: { 'Glúteo mayor': 65, 'Isquiotibiales': 25, 'Lumbar': 10 } },
    { name: 'Patada de Glúteo en Polea', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: [], equipment: 'Polea', shares: { 'Glúteo mayor': 75, 'Isquiotibiales': 15, 'Glúteo medio': 10 } },
    { name: 'Abducción de Cadera', muscle: 'Glúteo', muscleDetail: 'Glúteo medio', secondary: [], equipment: 'Máquina', shares: { 'Glúteo medio': 60, 'Glúteo menor': 20, 'Abductores': 20 } },
    { name: 'Peso Muerto Sumo', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: ['Pierna', 'Espalda'], equipment: 'Barra', shares: { 'Glúteo mayor': 30, 'Aductores': 20, 'Cuádriceps (recto femoral)': 20, 'Lumbar': 20, 'Trapecio superior': 10 } },
    { name: 'Step Up', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: ['Pierna'], equipment: 'Mancuernas', shares: { 'Glúteo mayor': 35, 'Cuádriceps (recto femoral)': 30, 'Cuádriceps (vasto lateral)': 20, 'Glúteo medio': 15 } },
    // Nuevos
    { name: 'Abducción con Banda', muscle: 'Glúteo', muscleDetail: 'Glúteo medio', secondary: [], equipment: 'Accesorio', shares: { 'Glúteo medio': 65, 'Glúteo menor': 20, 'Abductores': 15 } },
    { name: 'Puente de Glúteo con Banda', muscle: 'Glúteo', muscleDetail: 'Glúteo mayor', secondary: [], equipment: 'Accesorio', shares: { 'Glúteo mayor': 55, 'Glúteo medio': 25, 'Isquiotibiales': 20 } },

    // ================= ABDOMEN =================
    { name: 'Plancha', muscle: 'Abdomen', muscleDetail: 'Transverso abdominal', secondary: [], equipment: 'Peso Corporal', shares: { 'Transverso abdominal': 45, 'Recto abdominal (superior)': 25, 'Recto abdominal (inferior)': 20, 'Oblicuos': 10 } },
    { name: 'Crunch Abdominal', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (superior)', secondary: [], equipment: 'Peso Corporal', shares: { 'Recto abdominal (superior)': 75, 'Recto abdominal (inferior)': 15, 'Oblicuos': 10 } },
    { name: 'Elevación de Piernas', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (inferior)', secondary: [], equipment: 'Peso Corporal', shares: { 'Recto abdominal (inferior)': 70, 'Recto abdominal (superior)': 15, 'Oblicuos': 15 } },
    { name: 'Giro Ruso', muscle: 'Abdomen', muscleDetail: 'Oblicuos', secondary: [], equipment: 'Peso Corporal', shares: { 'Oblicuos': 75, 'Recto abdominal (superior)': 25 } },
    { name: 'Rueda Abdominal', muscle: 'Abdomen', muscleDetail: 'Transverso abdominal', secondary: ['Espalda'], equipment: 'Accesorio', shares: { 'Transverso abdominal': 35, 'Recto abdominal (superior)': 30, 'Recto abdominal (inferior)': 20, 'Dorsal ancho': 15 } },
    { name: 'Crunch en Polea', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (superior)', secondary: [], equipment: 'Polea', shares: { 'Recto abdominal (superior)': 70, 'Recto abdominal (inferior)': 20, 'Oblicuos': 10 } },
    { name: 'Elevación de Rodillas en Paralelas', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (inferior)', secondary: [], equipment: 'Peso Corporal', shares: { 'Recto abdominal (inferior)': 65, 'Oblicuos': 20, 'Recto abdominal (superior)': 15 } },
    { name: 'Plancha Lateral', muscle: 'Abdomen', muscleDetail: 'Oblicuos', secondary: [], equipment: 'Peso Corporal', shares: { 'Oblicuos': 65, 'Transverso abdominal': 25, 'Glúteo medio': 10 } },
    // Nuevos
    { name: 'Elevación de Piernas Colgado', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (inferior)', secondary: [], equipment: 'Peso Corporal', shares: { 'Recto abdominal (inferior)': 65, 'Oblicuos': 20, 'Recto abdominal (superior)': 15 } },
    { name: 'Crunch Invertido', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (inferior)', secondary: [], equipment: 'Peso Corporal', shares: { 'Recto abdominal (inferior)': 75, 'Recto abdominal (superior)': 15, 'Transverso abdominal': 10 } },
    { name: 'Crunch en Máquina', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (superior)', secondary: [], equipment: 'Máquina', shares: { 'Recto abdominal (superior)': 70, 'Recto abdominal (inferior)': 20, 'Oblicuos': 10 } },
    { name: 'Mountain Climbers', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (inferior)', secondary: [], equipment: 'Peso Corporal', shares: { 'Recto abdominal (inferior)': 45, 'Oblicuos': 25, 'Transverso abdominal': 20, 'Deltoides anterior': 10 } },
    { name: 'Dead Bug', muscle: 'Abdomen', muscleDetail: 'Transverso abdominal', secondary: [], equipment: 'Peso Corporal', shares: { 'Transverso abdominal': 55, 'Recto abdominal (inferior)': 30, 'Oblicuos': 15 } },
    { name: 'Encogimientos en Banco', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (superior)', secondary: [], equipment: 'Peso Corporal', shares: { 'Recto abdominal (superior)': 80, 'Recto abdominal (inferior)': 20 } },

    // ================= CARDIO =================
    // Puntúan por duración, no por kg levantados
    { name: 'Cinta de Correr', muscle: 'Pierna', muscleDetail: 'Gemelos', secondary: [], equipment: 'Máquina', isCardio: true, shares: { 'Gemelos': 30, 'Cuádriceps (recto femoral)': 25, 'Isquiotibiales': 20, 'Glúteo mayor': 15, 'Sóleo': 10 } },
    { name: 'Bicicleta Estática', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: ['Glúteo'], equipment: 'Máquina', isCardio: true, shares: { 'Cuádriceps (recto femoral)': 40, 'Cuádriceps (vasto lateral)': 25, 'Glúteo mayor': 20, 'Gemelos': 15 } },
    { name: 'Elíptica', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: ['Espalda'], equipment: 'Máquina', isCardio: true, shares: { 'Cuádriceps (recto femoral)': 30, 'Glúteo mayor': 25, 'Isquiotibiales': 25, 'Gemelos': 20 } },
    { name: 'Comba', muscle: 'Pierna', muscleDetail: 'Gemelos', secondary: [], equipment: 'Accesorio', isCardio: true, shares: { 'Gemelos': 50, 'Sóleo': 30, 'Tibial anterior': 20 } },
    { name: 'Burpees', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Pierna', 'Abdomen'], equipment: 'Peso Corporal', isCardio: true, shares: { 'Pectoral medio': 25, 'Cuádriceps (recto femoral)': 25, 'Glúteo mayor': 20, 'Recto abdominal (superior)': 15, 'Deltoides anterior': 15 } },
    { name: 'Sprint', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: ['Glúteo'], equipment: 'Peso Corporal', isCardio: true, shares: { 'Isquiotibiales': 30, 'Glúteo mayor': 25, 'Cuádriceps (recto femoral)': 25, 'Gemelos': 20 } },
    // Nuevos
    { name: 'Sentadilla con Salto', muscle: 'Pierna', muscleDetail: 'Cuádriceps (recto femoral)', secondary: ['Glúteo'], equipment: 'Peso Corporal', isCardio: true, shares: { 'Cuádriceps (recto femoral)': 35, 'Glúteo mayor': 30, 'Gemelos': 20, 'Isquiotibiales': 15 } },

    // ================= MÁQUINAS DE GIMNASIO =================
    // Parque de máquinas habitual de un gimnasio de cadena (tipo Fitness Park):
    // guiadas, asistidas y multipower. Son las que más se usan cuando no quieres
    // montar barra, y cada una apunta a su músculo concreto.
    { name: 'Dominadas Asistidas', muscle: 'Espalda', muscleDetail: 'Dorsal ancho', secondary: ['Bíceps'], equipment: 'Máquina', shares: { 'Dorsal ancho': 50, 'Redondo mayor': 15, 'Bíceps braquial (cabeza larga)': 20, 'Trapecio medio': 15 } },
    { name: 'Fondos Asistidos', muscle: 'Pecho', muscleDetail: 'Pectoral inferior', secondary: ['Tríceps'], equipment: 'Máquina', shares: { 'Pectoral inferior': 45, 'Tríceps (cabeza larga)': 30, 'Tríceps (cabeza lateral)': 15, 'Deltoides anterior': 10 } },
    { name: 'Remo Alto en Máquina', muscle: 'Espalda', muscleDetail: 'Trapecio medio', secondary: ['Bíceps'], equipment: 'Máquina', shares: { 'Trapecio medio': 30, 'Dorsal ancho': 30, 'Romboides': 25, 'Bíceps braquial (cabeza larga)': 15 } },
    { name: 'Press Declinado en Máquina', muscle: 'Pecho', muscleDetail: 'Pectoral inferior', secondary: ['Tríceps'], equipment: 'Máquina', shares: { 'Pectoral inferior': 60, 'Pectoral medio': 15, 'Tríceps (cabeza lateral)': 25 } },
    { name: 'Extensión de Tríceps en Máquina', muscle: 'Tríceps', muscleDetail: 'Tríceps (cabeza lateral)', secondary: [], equipment: 'Máquina', shares: { 'Tríceps (cabeza lateral)': 45, 'Tríceps (cabeza medial)': 35, 'Tríceps (cabeza larga)': 20 } },
    { name: 'Curl Predicador en Máquina', muscle: 'Bíceps', muscleDetail: 'Bíceps braquial (cabeza corta)', secondary: [], equipment: 'Máquina', shares: { 'Bíceps braquial (cabeza corta)': 55, 'Braquial anterior': 30, 'Bíceps braquial (cabeza larga)': 15 } },
    { name: 'Curl Femoral de Pie', muscle: 'Pierna', muscleDetail: 'Isquiotibiales', secondary: [], equipment: 'Máquina', shares: { 'Isquiotibiales': 85, 'Gemelos': 15 } },
    // --- MULTIPOWER (barra guiada) ---
    { name: 'Press de Banca en Multipower', muscle: 'Pecho', muscleDetail: 'Pectoral medio', secondary: ['Tríceps', 'Hombro'], equipment: 'Máquina', shares: { 'Pectoral medio': 55, 'Pectoral inferior': 10, 'Tríceps (cabeza lateral)': 20, 'Deltoides anterior': 15 } },
    { name: 'Press Inclinado en Multipower', muscle: 'Pecho', muscleDetail: 'Pectoral superior', secondary: ['Tríceps', 'Hombro'], equipment: 'Máquina', shares: { 'Pectoral superior': 55, 'Pectoral medio': 10, 'Deltoides anterior': 20, 'Tríceps (cabeza lateral)': 15 } },
    { name: 'Press Militar en Multipower', muscle: 'Hombro', muscleDetail: 'Deltoides anterior', secondary: ['Tríceps'], equipment: 'Máquina', shares: { 'Deltoides anterior': 50, 'Deltoides lateral': 20, 'Tríceps (cabeza lateral)': 25, 'Trapecio superior': 5 } },
    { name: 'Elevación de Gemelos en Multipower', muscle: 'Pierna', muscleDetail: 'Gemelos', secondary: [], equipment: 'Máquina', shares: { 'Gemelos': 80, 'Sóleo': 20 } },
    // --- POLEA / CROSSOVER ---
    { name: 'Encogimientos en Polea', muscle: 'Espalda', muscleDetail: 'Trapecio superior', secondary: [], equipment: 'Polea', shares: { 'Trapecio superior': 85, 'Trapecio medio': 15 } },
    { name: 'Crunch de Rodillas en Polea', muscle: 'Abdomen', muscleDetail: 'Recto abdominal (superior)', secondary: [], equipment: 'Polea', shares: { 'Recto abdominal (superior)': 65, 'Recto abdominal (inferior)': 20, 'Oblicuos': 15 } }
];

module.exports = { EXERCISE_CATALOG };
