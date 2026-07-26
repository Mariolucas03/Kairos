const DailyLog = require('../models/DailyLog');
const User = require('../models/User');
const { getMadridMonthString } = require('../utils/dateHelpers');

// Premios del ranking mensual (posiciones 1, 2 y 3) — el banner del frontend
// (MonthlyRewardsBanner) muestra estos mismos importes.
const MONTHLY_PRIZES = [10000, 5000, 2500];

/**
 * Ranking del mes en curso (o del mes indicado) basado en el XP REALMENTE ganado
 * durante ese mes, agregando DailyLog.gains.xp.
 *
 * Antes el "premio mensual" se repartía ordenando por level/currentXP, que son
 * acumulados históricos: ganaba siempre el mismo veterano y un jugador nuevo muy
 * activo nunca podía competir. Esto lo convierte en un ranking mensual de verdad.
 *
 * @param {string} period "YYYY-MM" (por defecto, el mes actual en Madrid)
 * @param {number} limit  número de puestos a devolver
 */
const getMonthlyRanking = async (period = getMadridMonthString(), limit = 50) => {
    // DailyLog.date es un string "YYYY-MM-DD", así que filtramos por prefijo de mes
    // con comparación de strings (más eficiente que un $regex).
    const rows = await DailyLog.aggregate([
        { $match: { date: { $gte: `${period}-01`, $lte: `${period}-31` } } },
        {
            $group: {
                _id: '$user',
                monthlyXP: { $sum: { $ifNull: ['$gains.xp', 0] } },
                monthlyCoins: { $sum: { $ifNull: ['$gains.coins', 0] } },
                activeDays: { $sum: 1 }
            }
        },
        { $match: { monthlyXP: { $gt: 0 } } },
        { $sort: { monthlyXP: -1, activeDays: -1 } },
        { $limit: limit }
    ]);

    if (rows.length === 0) return [];

    const users = await User.find({ _id: { $in: rows.map(r => r._id) } })
        .select('username avatar frame level title clanRank')
        .lean();

    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    return rows
        .map((row, index) => {
            const u = userMap.get(row._id.toString());
            if (!u) return null; // Usuario borrado
            return {
                _id: u._id,
                position: index + 1,
                username: u.username,
                avatar: u.avatar,
                frame: u.frame,
                level: u.level || 1,
                title: u.title || 'Novato',
                clanRank: u.clanRank,
                monthlyXP: row.monthlyXP,
                monthlyCoins: row.monthlyCoins,
                activeDays: row.activeDays,
                xp: row.monthlyXP // alias para reutilizar el componente RankingItem
            };
        })
        .filter(Boolean)
        // Recalculamos posición por si algún usuario fue descartado
        .map((entry, index) => ({ ...entry, position: index + 1 }));
};

module.exports = { getMonthlyRanking, MONTHLY_PRIZES };
