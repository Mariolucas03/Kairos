const WorkoutLog = require('../models/WorkoutLog');
const Exercise = require('../models/Exercise');
const { MUSCLE_GROUPS, SPECIFIC_MUSCLES, resolveMuscleGroup, isSpecificMuscle } = require('../utils/muscles');

/**
 * RANGOS POR MÚSCULO
 *
 * Un músculo sube de rango por los KILOS ACUMULADOS que le has metido:
 *
 *     volumen = Σ (kg × repeticiones)   de todas tus sesiones, desde siempre
 *
 * Si en una sesión de press banca mueves 4.000 kg, esos 4.000 se suman a Pecho;
 * cuando el total llegue a 10.000 el músculo pasa a Madera, a 20.000 a Bronce,
 * y así hasta Leyenda. Diez rangos, cada uno con su color.
 *
 * 💡 EL PROBLEMA DE LOS EJERCICIOS QUE TRABAJAN VARIOS MÚSCULOS
 * Un press militar es hombro, pero también pecho y tríceps. Por eso cada
 * ejercicio no tiene "un" músculo sino un PRINCIPAL y una lista de SECUNDARIOS:
 * el principal se lleva el volumen entero y cada secundario un 40%. Así el press
 * militar da 4.000 a Hombro y 1.600 a Pecho y a Tríceps, sin tener que elegir.
 *
 * No se guarda nada nuevo en base de datos: todo se deriva de los WorkoutLog que
 * ya existen, así que los entrenos antiguos también cuentan desde el primer día.
 */

// Un músculo secundario aporta menos que el principal
const SECONDARY_FACTOR = 0.4;

// El cardio no tiene kg: puntúa por minutos
const CARDIO_POINTS_PER_MINUTE = 25;

// Diez rangos. Los dos primeros escalones son los que pidió el usuario
// (10.000 → Madera, 20.000 → Bronce) y a partir de ahí cada uno cuesta
// alrededor de un 70% más que el anterior.
const RANKS = [
    { key: 'novato', label: 'Novato', min: 0, color: '#71717a' },
    { key: 'madera', label: 'Madera', min: 10000, color: '#a16207' },
    { key: 'bronce', label: 'Bronce', min: 20000, color: '#c2703a' },
    { key: 'hierro', label: 'Hierro', min: 40000, color: '#64748b' },
    { key: 'plata', label: 'Plata', min: 75000, color: '#cbd5e1' },
    { key: 'oro', label: 'Oro', min: 130000, color: '#eab308' },
    { key: 'platino', label: 'Platino', min: 220000, color: '#22d3ee' },
    { key: 'diamante', label: 'Diamante', min: 380000, color: '#60a5fa' },
    { key: 'maestro', label: 'Maestro', min: 650000, color: '#a855f7' },
    { key: 'leyenda', label: 'Leyenda', min: 1000000, color: '#ef4444' }
];

/** Devuelve el rango alcanzado y el progreso hacia el siguiente (0-100). */
const getRankForPoints = (points) => {
    let index = 0;
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (points >= RANKS[i].min) { index = i; break; }
    }

    const current = RANKS[index];
    const next = RANKS[index + 1] || null;

    const progress = next
        ? Math.min(100, Math.round(((points - current.min) / (next.min - current.min)) * 100))
        : 100;

    return {
        rank: current.key,
        rankLabel: current.label,
        rankColor: current.color,
        rankIndex: index,
        maxRankIndex: RANKS.length - 1,
        nextRankLabel: next ? next.label : null,
        pointsToNext: next ? Math.max(0, next.min - points) : 0,
        progress
    };
};

// Identificador de semana ISO ("2026-W30") para medir constancia
const getWeekKey = (date) => {
    const d = new Date(date);
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
    return `${target.getUTCFullYear()}-W${week}`;
};

/**
 * Calcula los rangos de los 8 grupos musculares de un usuario.
 * @returns {Promise<Object>} { Pecho: { points, volume, weeks, sets, rank... }, ... }
 */
const getMuscleRanks = async (userId) => {
    const [logs, exercises] = await Promise.all([
        WorkoutLog.find({ user: userId }).select('type date duration exercises').lean(),
        Exercise.find({ $or: [{ user: userId }, { isCustom: false }, { user: null }] })
            // ⚠️ Faltaba muscleDetail: sin él todo el volumen se acumulaba en el
            // grupo grande y la pierna entera subía de rango a la vez, aunque el
            // ejercicio dijera exactamente qué músculo trabaja.
            .select('name muscle muscleDetail secondary shares isCardio').lean()
    ]);

    // Índice nombre de ejercicio -> músculos, para no consultar por cada serie
    const byName = {};
    exercises.forEach(ex => {
        byName[ex.name.toLowerCase()] = {
            muscle: resolveMuscleGroup(ex.muscle),
            detail: ex.muscleDetail && isSpecificMuscle(ex.muscleDetail) ? ex.muscleDetail.trim() : '',
            secondary: (ex.secondary || []).map(s => resolveMuscleGroup(s)),
            // El reparto llega como Map de Mongoose o como objeto plano (.lean())
            shares: ex.shares ? Object.fromEntries(ex.shares instanceof Map ? ex.shares : Object.entries(ex.shares)) : null,
            isCardio: !!ex.isCardio
        };
    });

    // Acumuladores: los 8 grupos de siempre MÁS cada músculo concreto.
    // Se devuelven los dos: el grupo lo siguen usando el ranking y los eventos
    // de clan, y el músculo concreto es lo que pinta el mapa corporal.
    const stats = {};
    const nuevoAcumulador = () => ({ volume: 0, sets: 0, reps: 0, bestWeight: 0, weeks: new Set() });
    MUSCLE_GROUPS.forEach(g => { stats[g] = nuevoAcumulador(); });
    Object.values(SPECIFIC_MUSCLES).flat().forEach(m => { stats[m] = nuevoAcumulador(); });

    const addVolume = (clave, volume, weekKey, setCount = 0, reps = 0, weight = 0) => {
        const s = stats[clave];
        if (!s) return;
        s.volume += volume;
        s.sets += setCount;
        s.reps += reps;
        if (weight > s.bestWeight) s.bestWeight = weight;
        if (weekKey) s.weeks.add(weekKey);
    };

    logs.forEach(log => {
        const weekKey = getWeekKey(log.date);

        // Los entrenos de tipo 'sport' (cardio registrado aparte) puntúan por tiempo
        if (log.type === 'sport') {
            const minutos = (log.duration || 0) / 60;
            addVolume('Pierna', minutos * CARDIO_POINTS_PER_MINUTE, weekKey);
            return;
        }

        (log.exercises || []).forEach(ex => {
            const info = byName[(ex.name || '').toLowerCase()];
            // Si el ejercicio ya no existe en el catálogo, no sabemos su músculo
            if (!info) return;

            if (info.isCardio) {
                // Cardio dentro de una rutina: repartimos por duración del log
                const minutos = (log.duration || 0) / 60;
                addVolume(info.muscle, minutos * CARDIO_POINTS_PER_MINUTE, weekKey);
                return;
            }

            let volumen = 0, repeticiones = 0, mejorPeso = 0;
            (ex.sets || []).forEach(set => {
                const kg = Number(set.weight) || 0;
                const reps = Number(set.reps) || 0;
                // Peso corporal (0 kg) no puede valer 0: contamos las reps
                volumen += kg > 0 ? kg * reps : reps * 2;
                repeticiones += reps;
                if (kg > mejorPeso) mejorPeso = kg;
            });

            const nSeries = (ex.sets || []).length;

            if (info.shares) {
                // REPARTO POR PORCENTAJE (catálogo nuevo).
                // Cada músculo se lleva su parte del volumen, y su grupo padre
                // acumula lo mismo para que el ranking de siempre siga cuadrando.
                const porGrupo = {};
                Object.entries(info.shares).forEach(([musculo, pct]) => {
                    const parte = volumen * (Number(pct) || 0) / 100;
                    if (parte <= 0) return;

                    const esPrincipal = musculo === info.detail || musculo === info.muscle;
                    addVolume(musculo, parte, weekKey, esPrincipal ? nSeries : 0, esPrincipal ? repeticiones : 0, esPrincipal ? mejorPeso : 0);

                    const grupo = resolveMuscleGroup(musculo, null);
                    if (grupo && grupo !== musculo) porGrupo[grupo] = (porGrupo[grupo] || 0) + parte;
                });

                Object.entries(porGrupo).forEach(([grupo, parte]) => {
                    const esPrincipal = grupo === info.muscle;
                    addVolume(grupo, parte, weekKey, esPrincipal ? nSeries : 0, esPrincipal ? repeticiones : 0, esPrincipal ? mejorPeso : 0);
                });
            } else {
                // REPARTO ANTIGUO, para los ejercicios que aún no tienen porcentajes
                addVolume(info.muscle, volumen, weekKey, nSeries, repeticiones, mejorPeso);
                if (info.detail) {
                    addVolume(info.detail, volumen, weekKey, nSeries, repeticiones, mejorPeso);
                }
                info.secondary.forEach(sec => {
                    if (sec !== info.muscle) addVolume(sec, volumen * SECONDARY_FACTOR, weekKey);
                });
            }
        });
    });

    // La puntuación ES el volumen acumulado: kilos movidos, sin más vueltas
    const result = {};
    Object.entries(stats).forEach(([clave, s]) => {
        const points = Math.round(s.volume);
        const esGrupo = MUSCLE_GROUPS.includes(clave);

        result[clave] = {
            points,
            volume: points,
            weeks: s.weeks.size,
            sets: s.sets,
            reps: s.reps,
            bestWeight: s.bestWeight,
            // Para poder separar en la interfaz los 8 grupos de los músculos concretos
            isGroup: esGrupo,
            group: esGrupo ? clave : resolveMuscleGroup(clave),
            ...getRankForPoints(points)
        };
    });

    return result;
};

/**
 * Historial de un ejercicio para las gráficas de progreso.
 * Por cada día entrenado devuelve el mejor peso, el volumen y las series.
 */
const getExerciseProgress = async (userId, exerciseName) => {
    const logs = await WorkoutLog.find({
        user: userId,
        'exercises.name': exerciseName
    }).select('date exercises').sort({ date: 1 }).lean();

    const puntos = [];
    logs.forEach(log => {
        (log.exercises || []).forEach(ex => {
            if (ex.name !== exerciseName) return;
            let volumen = 0, mejorPeso = 0, mejorReps = 0, reps = 0;
            (ex.sets || []).forEach(set => {
                const kg = Number(set.weight) || 0;
                const r = Number(set.reps) || 0;
                volumen += kg > 0 ? kg * r : r * 2;
                reps += r;
                // El récord es el peso más alto y, a igualdad de peso, más reps
                if (kg > mejorPeso || (kg === mejorPeso && r > mejorReps)) {
                    mejorPeso = kg;
                    mejorReps = r;
                }
            });
            puntos.push({
                date: log.date,
                volume: Math.round(volumen),
                bestWeight: mejorPeso,
                bestReps: mejorReps,
                sets: (ex.sets || []).length,
                reps
            });
        });
    });

    // Récord absoluto: el peso más alto y con cuántas repeticiones se hizo
    const record = puntos.reduce((mejor, p) => {
        if (!mejor) return p;
        if (p.bestWeight > mejor.bestWeight) return p;
        if (p.bestWeight === mejor.bestWeight && p.bestReps > mejor.bestReps) return p;
        return mejor;
    }, null);

    return {
        name: exerciseName,
        sessions: puntos.length,
        points: puntos,
        record: record ? { weight: record.bestWeight, reps: record.bestReps, date: record.date } : null
    };
};

module.exports = { getMuscleRanks, getExerciseProgress, getRankForPoints, RANKS };
