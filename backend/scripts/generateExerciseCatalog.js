/**
 * Genera backend/data/exercises.json a partir de ExerciseGymGifsDB.
 *
 * Regla clave: los 82 ejercicios curados de exerciseCatalog.js MANDAN. Sus
 * nombres están referenciados por las rutinas y por el historial de entrenos
 * (WorkoutLog guarda el nombre, no el id), así que no se renombran ni se
 * sustituyen: sólo se les engancha el gif del que mejor case. El resto del
 * repo entra como catálogo ampliado, saltando los que chocan de nombre.
 *
 * Uso:  node scripts/generateExerciseCatalog.js            -> sólo informe
 *       node scripts/generateExerciseCatalog.js --write    -> escribe el JSON
 *
 * No se ejecuta en producción: el JSON generado se versiona y el backend sólo
 * lo lee. Se vuelve a lanzar a mano cuando se quiera actualizar el catálogo.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { EXERCISE_CATALOG } = require(path.join(RAIZ, 'utils', 'exerciseCatalog.js'));
const { MUSCLE_GROUPS } = require(path.join(RAIZ, 'utils', 'muscles.js'));
const { familiaDe } = require(path.join(RAIZ, 'utils', 'equipment.js'));

const BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@main/api';

// 19 músculos del repo -> grupo de Kairos + músculo concreto del modo PRO
const MUSCULO = {
    'abductors':        ['Pierna',  'Abductores'],
    'abs':              ['Abdomen', 'Recto abdominal (superior)'],
    'adductors':        ['Pierna',  'Aductores'],
    'biceps':           ['Bíceps',  'Bíceps braquial (cabeza larga)'],
    'calves':           ['Pierna',  'Gemelos'],
    'cardio':           ['Pierna',  ''],
    'delts':            ['Hombro',  'Deltoides lateral'],
    'forearms':         ['Bíceps',  'Braquiorradial'],
    'glutes':           ['Glúteo',  'Glúteo mayor'],
    'hamstrings':       ['Pierna',  'Isquiotibiales'],
    'lats':             ['Espalda', 'Dorsal ancho'],
    'levator-scapulae': ['Espalda', 'Trapecio superior'],
    'pectorals':        ['Pecho',   'Pectoral medio'],
    'quads':            ['Pierna',  'Cuádriceps (recto femoral)'],
    'serratus-anterior':['Pecho',   'Serrato anterior'],
    'spine':            ['Espalda', 'Lumbar'],
    'traps':            ['Espalda', 'Trapecio superior'],
    'triceps':          ['Tríceps', 'Tríceps (cabeza larga)'],
    'upper-back':       ['Espalda', 'Romboides']
};

/**
 * Corrección del grupo por el nombre del ejercicio.
 *
 * El campo `muscle` del repo es su músculo "principal", y con los movimientos
 * compuestos se va: mete en `glutes` las sentadillas, las prensas, las zancadas
 * y los pesos muertos, y en `biceps` las dominadas y los jalones. Traducido tal
 * cual, el selector enseñaba 79 sentadillas y prensas bajo la cabecera GLÚTEO.
 *
 * Sólo afecta a la ampliación: los 82 curados conservan su grupo de siempre.
 */
const AFINAR = {
    // De 'glutes' sólo se queda en Glúteo lo que de verdad es glúteo-dominante
    glutes: [
        [/puente|bridge|hip thrust|patada|kickback|extensión de cadera|hip extension|pull through|glúteo|gluteo|donkey|fire hydrant|clamshell|almeja|coz/i, 'Glúteo', 'Glúteo mayor'],
        [/sentadilla|squat|prensa|leg press|zancada|lunge|step-?up|split|subida|pistol|sissy/i, 'Pierna', 'Cuádriceps (recto femoral)'],
        [/peso muerto|deadlift|good morning|buenos días|hinge|femoral|isquio/i, 'Pierna', 'Isquiotibiales']
    ],
    // Los tirones verticales y horizontales son espalda, por mucho que el bíceps
    // trabaje: si no, "Dominada" aparece en la lista de Bíceps
    biceps: [
        [/dominada|pull-?up|chin-?up|jalón|pulldown|remo\b/i, 'Espalda', 'Dorsal ancho']
    ]
};

const afinarGrupo = (musculoRepo, nombre, grupo, detalle) => {
    for (const [re, nuevoGrupo, nuevoDetalle] of (AFINAR[musculoRepo] || [])) {
        if (re.test(nombre)) return [nuevoGrupo, nuevoDetalle];
    }
    return [grupo, detalle];
};

// 12 equipos del repo -> vocabulario de Kairos (los 5 primeros ya existían)
const EQUIPO = {
    'barbell':    'Barra',
    'dumbbell':   'Mancuernas',
    'cable':      'Polea',
    'machine':    'Máquina',
    'lever':      'Máquina',
    'bodyweight': 'Peso Corporal',
    'smith':      'Multipower',
    'ez-bar':     'Barra Z',
    'kettlebell': 'Kettlebell',
    'band':       'Banda Elástica',
    'sled':       'Trineo',
    'other':      'Otro'
};

// Normalización para comparar nombres: sin tildes, sin puntuación, sin
// palabras de relleno que sólo cambian la redacción ("con", "de", "en"...).
const RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'en', 'a', 'al', 'y', 'para', 'sobre', 'un', 'una']);
const norm = (s) => String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(w => w && !RELLENO.has(w))
    .join(' ')
    .trim();

const clave = (s) => norm(s).split(' ').sort().join(' '); // insensible al orden

const get = async (p) => {
    const r = await fetch(`${BASE}/${p}`);
    if (!r.ok) throw new Error(`${p} -> ${r.status}`);
    return r.json();
};

// Alias manuales, con el slug comprobado contra el repo. Los que no existen
// se avisan por consola y caen al emparejado difuso.
const ALIAS = {
    // Pecho
    'Press de Banca': 'barbell-bench-press',
    'Press Inclinado con Barra': 'barbell-incline-bench-press',
    'Press Declinado': 'barbell-decline-bench-press',
    'Press de Banca con Mancuernas': 'dumbbell-bench-press',
    'Press Inclinado con Mancuernas': 'dumbbell-incline-bench-press',
    'Aperturas con Mancuernas': 'dumbbell-fly',
    'Cruce de Poleas': 'cable-cross-over-variation',
    'Flexiones': 'push-up',
    'Fondos en Paralelas': 'chest-dip',
    'Pullover': 'dumbbell-pullover',
    // Espalda
    'Dominadas': 'pull-up',
    'Jalón al Pecho': 'cable-pulldown',
    'Remo con Barra': 'barbell-bent-over-row',
    'Remo con Mancuerna': 'dumbbell-bent-over-row',
    'Remo en Polea Baja': 'cable-seated-row',
    'Remo en Máquina': 'lever-seated-row',
    'Peso Muerto': 'barbell-deadlift',
    'Peso Muerto Rumano': 'barbell-romanian-deadlift',
    'Encogimientos de Hombros': 'dumbbell-shrug',
    'Hiperextensiones': 'lever-back-extension',
    // Hombro
    'Press Militar': 'barbell-standing-wide-military-press',
    'Press de Hombro con Mancuernas': 'dumbbell-seated-shoulder-press',
    'Press Arnold': 'dumbbell-arnold-press',
    'Elevaciones Laterales': 'dumbbell-lateral-raise',
    'Elevaciones Frontales': 'dumbbell-front-raise',
    'Pájaros (Deltoide Posterior)': 'dumbbell-rear-lateral-raise',
    'Elevaciones Laterales en Polea': 'cable-lateral-raise',
    'Remo al Mentón': 'barbell-upright-row',
    'Rotación Externa': 'cable-standing-shoulder-external-rotation',
    // Bíceps
    'Curl de Bíceps con Barra': 'barbell-curl',
    'Curl Predicador': 'barbell-preacher-curl',
    'Curl en Polea': 'cable-curl',
    'Curl Inclinado': 'dumbbell-incline-curl',
    'Curl con Mancuernas': 'dumbbell-biceps-curl',
    'Curl Martillo': 'dumbbell-hammer-curl-v-2',
    'Curl Concentrado': 'dumbbell-concentration-curl',
    // Tríceps
    'Extensión en Polea': 'cable-pushdown',
    'Fondos en Banco': 'bench-dip-knees-bent',
    'Patada de Tríceps': 'dumbbell-kickback',
    'Press Francés': 'barbell-lying-triceps-extension',
    'Press Cerrado': 'barbell-close-grip-bench-press',
    'Extensión sobre la Cabeza': 'barbell-standing-overhead-triceps-extension',
    // Pierna
    'Sentadilla': 'barbell-full-squat',
    'Sentadilla Frontal': 'barbell-front-squat',
    'Prensa de Piernas': 'lever-alternate-leg-press',
    'Extensión de Cuádriceps': 'lever-leg-extension',
    'Zancadas': 'dumbbell-lunge',
    'Sentadilla Búlgara': 'dumbbell-single-leg-split-squat',
    'Hack Squat': 'barbell-hack-squat',
    'Elevación de Gemelos de Pie': 'lever-standing-calf-raise',
    'Elevación de Gemelos Sentado': 'lever-seated-calf-raise',
    'Aductores en Máquina': 'lever-seated-hip-adduction',
    'Abductores en Máquina': 'lever-seated-hip-abduction',
    'Peso Muerto Piernas Rígidas': 'dumbbell-stiff-leg-deadlift',
    // Glúteo
    'Puente de Glúteo': 'barbell-glute-bridge',
    'Patada de Glúteo en Polea': 'cable-standing-hip-extension',
    'Abducción de Cadera': 'side-hip-abduction',
    'Peso Muerto Sumo': 'barbell-sumo-deadlift',
    'Step Up': 'dumbbell-step-up',
    // Abdomen
    'Plancha': 'weighted-front-plank',
    'Giro Ruso': 'russian-twist',
    'Crunch Abdominal': 'crunch-floor',
    'Elevación de Piernas': 'lying-leg-raise-flat-bench',
    'Elevación de Rodillas en Paralelas': 'vertical-leg-raise-on-parallel-bars',
    'Plancha Lateral': 'bodyweight-incline-side-plank',
    // --- Segunda tanda: los que se añadieron al catálogo curado después de la
    // primera importación. Todos comprobados contra el repo uno a uno.
    // Pecho
    'Aperturas Inclinadas': 'dumbbell-incline-fly',
    'Flexiones Declinadas': 'decline-push-up',
    'Flexiones Diamante': 'diamond-push-up',
    'Press de Banca en Multipower': 'smith-bench-press',
    'Press Inclinado en Multipower': 'smith-incline-bench-press',
    'Fondos Asistidos': 'assisted-chest-dip-kneeling',
    // Espalda
    'Dominadas Supinas': 'chin-up',
    'Dominadas Neutras': 'chin-ups-narrow-parallel-grip',
    'Dominadas Lastradas': 'weighted-pull-up',
    'Dominadas Asistidas': 'assisted-pull-up',
    'Jalón Tras Nuca': 'cable-wide-grip-rear-pulldown-behind-neck',
    'Buenos Días': 'barbell-good-morning',
    'Encogimientos con Barra': 'barbell-shrug',
    'Encogimientos en Polea': 'cable-shrug',
    'Pull-over en Polea': 'cable-lying-extension-pullover-with-rope-attachment',
    // Hombro
    'Press de Hombro en Máquina': 'lever-shoulder-press',
    'Press Militar en Multipower': 'smith-standing-military-press',
    'Pájaros en Máquina': 'lever-seated-reverse-fly',
    'Pájaros en Polea': 'cable-standing-cross-over-high-reverse-fly',
    'Rotación Interna en Polea': 'cable-seated-shoulder-internal-rotation',
    // Bíceps
    'Curl Araña': 'ez-barbell-spider-curl',
    // Tríceps
    'Extensión con Cuerda': 'cable-pushdown-with-rope-attachment',
    'Extensión sobre la Cabeza en Polea': 'cable-rope-high-pulley-overhead-tricep-extension',
    'Press Francés con Mancuernas': 'dumbbell-lying-triceps-extension',
    'Extensión a una Mano': 'cable-one-arm-tricep-pushdown',
    // Pierna
    'Sentadilla Sissy': 'sissy-squat',
    'Sentadilla en Multipower': 'smith-squat',
    'Sentadilla Sumo': 'smith-sumo-squat',
    'Zancadas Caminando': 'walking-lunge',
    'Curl Nórdico': 'self-assisted-inverse-leg-curl',
    'Aductores en Polea': 'cable-hip-adduction',
    'Elevación de Gemelos a una Pierna': 'single-leg-calf-raise-on-a-dumbbell',
    'Elevación de Gemelos en Prensa': 'sled-calf-press-on-leg-press',
    'Elevación de Gemelos en Multipower': 'smith-standing-leg-calf-raise',
    // Glúteo
    'Hip Thrust': 'resistance-band-hip-thrusts-on-knees-female',
    'Abducción con Banda': 'resistance-band-seated-hip-abduction',
    'Puente de Glúteo con Banda': 'low-glute-bridge-on-floor',
    // Abdomen
    'Elevación de Piernas Colgado': 'hanging-leg-raise',
    'Mountain Climbers': 'mountain-climber',
    'Encogimientos en Banco': 'reverse-crunch',

    // Cardio
    'Cinta de Correr': 'walking-on-incline-treadmill',
    'Bicicleta Estática': 'stationary-bike-run-v-3',
    'Elíptica': 'walk-elliptical-cross-trainer',
    'Burpees': 'burpee',
    'Sprint': 'wind-sprints'
};

// Emparejado difuso de reserva: sólo dentro del mismo grupo y sólo si el
// parecido es alto. Un gif equivocado es peor que ningún gif.
const UMBRAL = 0.6;

(async () => {
    const escribir = process.argv.includes('--write');
    const { exercises: crudos } = await get('es/exercises.json');

    // --- Normalizado del repo ---
    const repo = crudos.map(e => {
        const [grupoBase, detalleBase] = MUSCULO[e.muscle] || ['Pecho', ''];
        const [grupo, detalle] = afinarGrupo(e.muscle, e.name, grupoBase, detalleBase);
        const esCardio = e.category === 'cardio' || e.muscle === 'cardio';
        const secundarios = [...new Set(
            (e.secondaryMuscles || [])
                .map(s => (MUSCULO[s] || [])[0])
                // Si el ejercicio ha cambiado de grupo, el original pasa a ser
                // secundario: una sentadilla es Pierna, pero el glúteo trabaja.
                .concat(grupo !== grupoBase ? [grupoBase] : [])
                .filter(g => g && g !== grupo && MUSCLE_GROUPS.includes(g))
        )];
        const equipo = EQUIPO[e.equipment] || 'Otro';
        return {
            slug: e.slug,
            name: e.name,
            muscle: grupo,
            muscleDetail: detalle,
            secondary: secundarios,
            equipment: equipo,
            equipmentGroup: familiaDe(equipo),
            isCardio: esCardio,
            bodyPart: e.bodyPart,
            gif: e.gifUrl,
            thumb: e.thumbUrl,
            instructions: e.instructions || []
        };
    });

    const porSlug = new Map(repo.map(e => [e.slug, e]));
    const porClave = new Map();
    repo.forEach(e => { if (!porClave.has(clave(e.name))) porClave.set(clave(e.name), e); });

    // Tokens para el emparejado difuso de reserva
    const toks = (s) => new Set(norm(s).split(' ').filter(Boolean));
    const jac = (a, b) => {
        const inter = [...a].filter(x => b.has(x)).length;
        return inter / (a.size + b.size - inter);
    };
    const repoTok = repo.map(e => ({ e, t: toks(e.name) }));

    // Alias que apuntan a un slug inexistente: mejor saberlo que tragárselo
    const aliasRotos = Object.entries(ALIAS).filter(([, slug]) => !porSlug.has(slug));

    // --- Los 82 curados, enriquecidos ---
    const usados = new Set();
    let porAlias = 0, porNombre = 0, porDifuso = [], sinGif = [];

    const core = EXERCISE_CATALOG.map(ex => {
        let m = null;
        if (ALIAS[ex.name] && porSlug.has(ALIAS[ex.name])) { m = porSlug.get(ALIAS[ex.name]); porAlias++; }
        else if (porClave.has(clave(ex.name))) { m = porClave.get(clave(ex.name)); porNombre++; }
        else if (!ex.isCardio) {
            // En cardio el parecido de nombres engaña: "Remo (Máquina)" es la
            // máquina de remo del gimnasio, no un remo de espalda en polea.
            const t = toks(ex.name);
            const mejor = repoTok
                .filter(c => c.e.muscle === ex.muscle)
                .map(c => ({ e: c.e, s: jac(t, c.t) }))
                .sort((a, b) => b.s - a.s)[0];
            if (mejor && mejor.s >= UMBRAL) { m = mejor.e; porDifuso.push(`${ex.name}  ->  ${m.name}  [${m.slug}] ${mejor.s.toFixed(2)}`); }
        }
        if (m) usados.add(m.slug); else sinGif.push(ex.name);

        return {
            ...ex,
            secondary: ex.secondary || [],
            equipment: ex.equipment || 'Barra',
            equipmentGroup: familiaDe(ex.equipment || 'Barra'),
            isCardio: !!ex.isCardio,
            isCore: true,
            slug: m ? m.slug : null,
            gif: m ? m.gif : null,
            thumb: m ? m.thumb : null,
            bodyPart: m ? m.bodyPart : '',
            instructions: m ? m.instructions : []
        };
    });

    // --- El resto del repo, saltando choques de nombre con los curados ---
    // El propio repo trae 42 nombres repetidos con slugs distintos: en una lista
    // que el usuario lee por nombre eso son entradas indistinguibles, así que
    // se queda la primera de cada nombre.
    const vistos = new Set(EXERCISE_CATALOG.map(e => clave(e.name)));
    const extra = [];
    for (const e of repo) {
        if (usados.has(e.slug)) continue;
        const k = clave(e.name);
        if (vistos.has(k)) continue;
        vistos.add(k);
        extra.push({ ...e, isCore: false });
    }

    // --- Informe ---
    console.log(`Repo:            ${repo.length}`);
    console.log(`Curados:         ${core.length}  (alias: ${porAlias}, nombre exacto: ${porNombre}, difuso: ${porDifuso.length}, sin gif: ${sinGif.length})`);
    console.log(`Ampliación:      ${extra.length}`);
    console.log(`TOTAL catálogo:  ${core.length + extra.length}`);
    if (aliasRotos.length) console.log(`\n⚠️  ALIAS CON SLUG INEXISTENTE (${aliasRotos.length}):\n  - ${aliasRotos.map(([n, s]) => `${n} -> ${s}`).join('\n  - ')}`);
    if (porDifuso.length) console.log(`\nEmparejados por parecido (revisar):\n  - ${porDifuso.join('\n  - ')}`);
    if (sinGif.length) console.log(`\nCurados SIN gif (${sinGif.length}):\n  - ${sinGif.join('\n  - ')}`);

    const porGrupo = {};
    [...core, ...extra].forEach(e => { porGrupo[e.muscle] = (porGrupo[e.muscle] || 0) + 1; });
    console.log('\nPor grupo:', JSON.stringify(porGrupo, null, 1));

    const dupSlug = extra.map(e => e.slug).filter((s, i, a) => a.indexOf(s) !== i);
    const dupNombre = [...core, ...extra].map(e => clave(e.name)).filter((s, i, a) => a.indexOf(s) !== i);
    console.log(`\nSlugs duplicados: ${dupSlug.length} | Nombres duplicados: ${dupNombre.length}`);
    if (dupNombre.length) console.log('  ej:', dupNombre.slice(0, 8).join(' | '));

    if (escribir) {
        const destino = path.join(RAIZ, 'data', 'exercises.json');
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, JSON.stringify([...core, ...extra], null, 0), 'utf8');
        const kb = (fs.statSync(destino).size / 1024).toFixed(0);
        console.log(`\n✅ Escrito ${destino} (${kb} KB)`);
    } else {
        console.log('\n(informe solamente; usa --write para generar el JSON)');
    }
})().catch(e => console.error('ERROR', e));
