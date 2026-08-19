export const getRewardForDay = (day) => {
    // Premios crecientes. El día 7 da un super premio.
    // 🔥 Debe coincidir con backend/utils/dailyRewards.js (esto es solo la vista previa;
    // el servidor es quien calcula y otorga la recompensa real).
    // Debe reflejar backend/utils/dailyRewards.js, que es quien manda.
    // El dia 7 multiplica x10: antes usaba 5 y daba menos XP y fichas que el 6.
    const multiplier = day === 7 ? 10 : day;

    return {
        coins: day === 7 ? 150 : 10 * day,
        gameCoins: 50 * multiplier,
        xp: 25 * multiplier,
        hp: day === 3 ? 10 : day === 7 ? 25 : 0,
        image: day === 7 ? '/assets/chests/gold_chest.png' : '/assets/icons/ficha.png',
        type: day === 7 ? 'epic' : 'normal'
    };
};