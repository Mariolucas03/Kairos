// 🔥 Tabla de recompensas diarias (autoridad del servidor — el cliente nunca decide el premio).
// Debe reflejar exactamente utils/rewardsGenerator.js del frontend, que solo se usa para la vista previa.
const getRewardForDay = (day) => {
    // ⚠️ REBAJADO, sobre todo la XP.
    //
    // Antes el dia 7 daba 250 de XP de un toque. Un entreno de 500 kcal da unos
    // 250 tambien: o sea que abrir la app pagaba igual que entrenar, y esto es
    // una app de gimnasio. La diaria premia la CONSTANCIA de aparecer, no puede
    // competir con lo que premia el esfuerzo.
    //
    // Las fichas se quedan altas a proposito: la diaria es la fuente principal
    // del casino desde que el entreno dejo de darlas.
    //
    //        dia:   1    2    3    4    5    6     7
    //     fichas:  40   80  120  160  200  240   400
    //         xp:  10   20   30   40   50   60   100
    //    monedas:   5   10   15   20   25   30    75
    const grande = day === 7;

    return {
        coins: grande ? 75 : 5 * day,
        gameCoins: grande ? 400 : 40 * day,
        xp: grande ? 100 : 10 * day,
        // Vida extra los dias de premio grande, para poder recuperarse de misiones falladas
        hp: day === 3 ? 10 : grande ? 25 : 0
    };
};

module.exports = { getRewardForDay };
