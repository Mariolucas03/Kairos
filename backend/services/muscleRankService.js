const WorkoutLog = require('../models/WorkoutLog');
const Exercise = require('../models/Exercise');
const { MUSCLE_GROUPS, resolveMuscleGroup } = require('../utils/muscles');

/**
 * RANGOS POR MÚSCULO
 *
 * Cada grupo muscular sube de rango con tres factores, los que pidió el usuario:
 *   1. Peso levantado  → volumen = Σ (kg × repeticiones)
 *   2. Repeticiones    → van dentro del volumen
 *   3. Constancia      → semanas DISTINTAS en las que has entrenado ese músculo
 *
 * La constancia es la clave para que no se pueda subir de rango en un solo día
 * a base de volumen bruto: entrenar 10 semanas seguidas pesa mucho en la nota.
 *
 * No se guarda nada nuevo en base de datos: todo se deriva de los WorkoutLog que
 * ya existen, así que los entrenos antiguos también cuentan desde el primer día.
 */

// Un músculo secundario aporta menos que el principal
const SECONDARY_FACTOR = 0.4;

// Cada semana distinta entrenada suma como este volumen (premia la constancia)
const WEEK_BONUS = 1500;

// El cardio no tiene kg: puntúa por minutos
const CARDIO_POINTS_PER_MINUTE = 25;

const RANKS = [
    { key: 'novato', label: 'Novato', min: 0, color: '#71717a' },
    { key: 'iniciado', label: 'Iniciado', min: 5000, color: '#a1a1aa' },
    { key: 'bronce', label: 'Bronce', min: 20000, color: '#b45309' },
    { key: 'plata', label: 'Plata', min: 50000, color: '#94a3b8' },
    { key: 'oro', label: 'Oro', min: 120000, color: '#eab308' },
    { key: 'platino', label: 'Platino', min: 250000, color: '#22d3ee' },
    { key: 'diamante', label: 'Diamante', min: 500000, color: '#a855f7' },
    { key: 'elite', label: 'Élite', min: 1000000, color: '#ef4444' }
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
            .select('name muscle secondary isCardio').lean()
    ]);

    // Índice nombre de ejercicio -> músculos, para no consultar por cada serie
    const byName = {};
    exercises.forEach(ex => {
        byName[ex.name.toLowerCase()] = {
            muscle: resolveMuscleGroup(ex.muscle),
            secondary: (ex.secondary || []).map(s => resolveMuscleGroup(s)),
            isCardio: !!ex.isCardio
        };
    });

    // Acumuladores por grupo
    const stats = {};
    MUSCLE_GROUPS.forEach(g => {
        stats[g] = { volume: 0, sets: 0, reps: 0, bestWeight: 0, weeks: new Set() };
    });

    const addVolume = (group, volume, weekKey, setCount = 0, reps = 0, weight = 0) => {
        const s = stats[group];
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

            addVolume(info.muscle, volumen, weekKey, (ex.sets || []).length, repeticiones, mejorPeso);
            // Los secundarios reciben una fracción
            info.secondary.forEach(sec => {
                if (sec !== info.muscle) addVolume(sec, volumen * SECONDARY_FACTOR, weekKey);
            });
        });
    });

    // Puntuación final = volumen + bonus por constancia
    const result = {};
    MUSCLE_GROUPS.forEach(g => {
        const s = stats[g];
        const weeks = s.weeks.size;
        const points = Math.round(s.volume + weeks * WEEK_BONUS);

        result[g] = {
            points,
            volume: Math.round(s.volume),
            weeks,
            sets: s.sets,
            reps: s.reps,
            bestWeight: s.bestWeight,
            ...getRankForPoints(points)
        };
    });

    return result;
};

module.exports = { getMuscleRanks, getRankForPoints, RANKS };
