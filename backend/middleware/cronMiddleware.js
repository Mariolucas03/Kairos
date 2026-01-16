const asyncHandler = require('express-async-handler');

const protectCron = asyncHandler(async (req, res, next) => {
    // Buscamos una clave secreta en la cabecera o query string
    const secret = req.headers['x-cron-secret'] || req.query.secret;

    // Esta clave la definirás tú en el panel de Render
    if (secret !== process.env.CRON_SECRET) {
        res.status(401);
        throw new Error('No autorizado: Secreto de Cron inválido');
    }
    next();
});

module.exports = { protectCron };