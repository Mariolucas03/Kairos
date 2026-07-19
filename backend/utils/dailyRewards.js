// 🔥 Tabla de recompensas diarias (autoridad del servidor — el cliente nunca decide el premio).
// Debe reflejar exactamente utils/rewardsGenerator.js del frontend, que solo se usa para la vista previa.
const getRewardForDay = (day) => {
    const multiplier = day === 7 ? 5 : day;

    return {
        coins: day === 7 ? 100 : 10 * multiplier,
        gameCoins: 50 * multiplier,
        xp: 25 * multiplier,
        // Vida extra los días de premio grande, para poder recuperarse de misiones falladas
        hp: day === 3 ? 10 : day === 7 ? 25 : 0
    };
};

module.exports = { getRewardForDay };
