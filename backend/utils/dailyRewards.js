// 🔥 Tabla de recompensas diarias (autoridad del servidor — el cliente nunca decide el premio).
// Debe reflejar exactamente utils/rewardsGenerator.js del frontend, que solo se usa para la vista previa.
const getRewardForDay = (day) => {
    // ⚠️ El dia 7 usaba multiplicador 5 mientras el dia 6 usaba 6: el "super
    // premio" daba MENOS XP y MENOS fichas que el dia anterior (125 vs 150 y
    // 250 vs 300). Solo subia en monedas. Ahora el 7 multiplica por 10, que es
    // lo que hace que valga la pena encadenar la semana entera.
    //
    // Ademas la diaria es ahora la fuente principal de FICHAS: el entreno dejo
    // de darlas para que el casino no saliera gratis.
    const multiplier = day === 7 ? 10 : day;

    return {
        coins: day === 7 ? 150 : 10 * day,
        gameCoins: 50 * multiplier,
        xp: 25 * multiplier,
        // Vida extra los dias de premio grande, para poder recuperarse de misiones falladas
        hp: day === 3 ? 10 : day === 7 ? 25 : 0
    };
};

module.exports = { getRewardForDay };
