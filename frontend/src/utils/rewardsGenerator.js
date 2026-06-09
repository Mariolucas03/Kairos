export const getRewardForDay = (day) => {
    // Premios crecientes. El día 7 da un super premio.
    const multiplier = day === 7 ? 5 : day; 

    return {
        coins: day === 7 ? 100 : 10 * multiplier,
        gameCoins: 50 * multiplier,
        xp: 25 * multiplier,
        image: day === 7 ? '/assets/chests/gold_chest.png' : '/assets/icons/ficha.png',
        type: day === 7 ? 'epic' : 'normal'
    };
};