export const getRewardForDay = (day) => {
    // Premios crecientes. El día 7 da un super premio.
    // 🔥 Debe coincidir con backend/utils/dailyRewards.js (esto es solo la vista previa;
    // el servidor es quien calcula y otorga la recompensa real).
    // Debe reflejar backend/utils/dailyRewards.js, que es quien manda.
    // Los numeros y el porque estan en backend/utils/dailyRewards.js, que es
    // quien manda. Aqui solo se copian para poder pintar la vista previa.
    const grande = day === 7;

    return {
        coins: grande ? 75 : 5 * day,
        gameCoins: grande ? 400 : 40 * day,
        xp: grande ? 100 : 10 * day,
        hp: day === 3 ? 10 : grande ? 25 : 0,
        image: day === 7 ? '/assets/chests/gold_chest.png' : '/assets/icons/ficha.png',
        type: day === 7 ? 'epic' : 'normal'
    };
};