const rateLimit = require('express-rate-limit');

/**
 * Limite para las rutas que llaman a la IA.
 *
 * El limite global es de 600 peticiones cada 15 minutos, pensado para peticiones
 * normales que cuestan una consulta a la base. Una llamada a la IA cuesta DINERO
 * de verdad —tokens de la cuenta del duenno de la app— y ademas tarda segundos.
 * A 600 cada cuarto de hora, una sola persona aburrida puede fundir la cuota del
 * mes en una tarde, sin necesidad de saber nada de seguridad.
 *
 * 40 cada 15 minutos da de sobra para usar la app: analizar varias comidas,
 * pedir un par de rutinas y calcular macros. Encadenarlas mil veces, no.
 */
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Has usado el analisis automatico muchas veces seguidas. Espera unos minutos.' }
});

module.exports = aiLimiter;
