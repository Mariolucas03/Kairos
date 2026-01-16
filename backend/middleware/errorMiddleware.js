const errorHandler = (err, req, res, next) => {
    // Si el status code ya fue establecido (ej. 404), úsalo. Si es 200, cámbialo a 500.
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode);

    // Log en consola del servidor (para que tú lo veas, pero sin romper la app)
    console.error(`❌ Error capturado: ${err.message}`);

    // Respuesta JSON al cliente
    res.json({
        message: err.message,
        // Solo mostramos el stack trace en modo desarrollo
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = {
    errorHandler,
};