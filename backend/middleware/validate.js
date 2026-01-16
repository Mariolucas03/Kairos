const validate = (schema) => (req, res, next) => {
    // Validamos req.body contra el esquema definido
    // abortEarly: false -> Para que nos diga TODOS los errores, no solo el primero
    // stripUnknown: true -> Elimina campos que no definimos (limpieza extra)
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        // Formateamos el mensaje de error para que sea legible
        const errorMessage = error.details
            .map((detail) => detail.message.replace(/"/g, ''))
            .join(', ');

        // Devolvemos 400 (Bad Request)
        return res.status(400).json({ message: `Error de validación: ${errorMessage}` });
    }

    // ¡TRUCO PRO! Reemplazamos req.body con 'value'.
    // Esto asegura que req.body ahora tiene los tipos correctos (números son números)
    // y sin campos basura extra.
    req.body = value;

    next();
};

module.exports = validate;