const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const ErrorLog = require('../models/ErrorLog');

/**
 * RECOGIDA DE FALLOS DE PANTALLA.
 *
 * Este endpoint lo llama cualquier usuario con sesión, no un administrador: lo
 * llama la app cuando se le rompe una pantalla en el móvil de quien sea. Eso
 * obliga a tratarlo con más cuidado que al resto, porque es lo único que
 * escribe en la base a petición del cliente y con texto libre dentro.
 *
 * Tres cosas lo contienen:
 *
 *  1. Se AGRUPA por huella con una escritura atómica. Un componente que peta en
 *     bucle no crea mil documentos: sube un contador.
 *  2. Todo lo que entra se recorta a lo que cabe. Un mensaje de error puede ser
 *     tan largo como quiera quien lo mande.
 *  3. Hay un techo de huellas DISTINTAS por día. Si alguien se pusiera a
 *     inventar mensajes para llenar la base, deja de crearse ninguna nueva; las
 *     que ya existen siguen contando, que es lo que interesa.
 */

const MAX_MENSAJE = 300;
const MAX_PILA = 1200;
const MAX_RUTA = 120;
const MAX_NAVEGADOR = 160;

// Huellas distintas que se pueden crear en un día. Con tres usuarios, veinte
// fallos DISTINTOS en un día ya sería una app en llamas; más que eso es ruido
// o alguien probando.
const MAX_HUELLAS_NUEVAS_POR_DIA = 40;

const recortar = (valor, tope) =>
    String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, tope);

/**
 * La huella agrupa "el mismo fallo".
 *
 * Se quitan los números del mensaje antes de calcularla: muchos errores llevan
 * dentro un id o un índice ("no se encuentra 6a95..."), y sin esto cada
 * ocurrencia sería un fallo distinto y volveríamos a tener mil filas.
 */
const calcularHuella = (mensaje, ruta) => {
    const normalizado = mensaje
        .toLowerCase()
        .replace(/[0-9a-f]{8,}/g, '#')   // ids, hashes
        .replace(/\d+/g, '#');           // números sueltos
    return crypto
        .createHash('sha1')
        .update(normalizado + '|' + ruta)
        .digest('hex')
        .slice(0, 16);
};

// @desc    Anotar que a alguien se le ha roto una pantalla
// @route   POST /api/errores
const registrarError = asyncHandler(async (req, res) => {
    const mensaje = recortar(req.body?.mensaje, MAX_MENSAJE);

    // Sin mensaje no hay nada que agrupar ni que leer después
    if (!mensaje) {
        return res.status(400).json({ message: 'Falta el mensaje' });
    }

    const ruta = recortar(req.body?.ruta, MAX_RUTA);
    const pila = recortar(req.body?.pila, MAX_PILA);
    const navegador = recortar(req.headers['user-agent'], MAX_NAVEGADOR);
    const origen = ['render', 'global', 'promesa'].includes(req.body?.origen)
        ? req.body.origen
        : 'render';

    const huella = calcularHuella(mensaje, ruta);

    // Se intenta primero SUMAR a una huella que ya exista. Es el camino normal
    // (un fallo se repite) y no crea nada.
    const yaExistia = await ErrorLog.findOneAndUpdate(
        { huella },
        {
            $inc: { veces: 1 },
            $set: {
                ultimaVez: new Date(),
                navegador,
                pila,
                // ⚠️ Si vuelve a pasar, VUELVE A LA LISTA aunque estuviera dado
                // por visto. Un fallo marcado como resuelto que sigue rompiendo
                // moviles y se queda escondido es peor que no tener panel: te
                // deja convencido de que lo arreglaste.
                //
                // Sí, eso significa que marcar como visto algo que sigue
                // pasando no dura. Es lo correcto: lo que hace que desaparezca
                // de la lista es arreglarlo, no taparlo.
                resuelto: false,
                resueltoEn: null
            },
            // Cuánta gente distinta lo sufre: uno puede ser su móvil, tres es la app
            $addToSet: { usuarios: req.user._id }
        },
        { new: true }
    );

    if (yaExistia) {
        return res.status(202).json({ registrado: true, veces: yaExistia.veces });
    }

    // Es una huella nueva. Aquí sí hay que mirar el techo del día.
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const nuevasHoy = await ErrorLog.countDocuments({ primeraVez: { $gte: desde } });

    if (nuevasHoy >= MAX_HUELLAS_NUEVAS_POR_DIA) {
        // Se responde OK a propósito: la app no tiene que hacer nada distinto
        // porque el servidor haya decidido no anotar uno más, y devolver un
        // error aquí solo conseguiría que la pantalla rota intentara avisar de
        // que no pudo avisar.
        return res.status(202).json({ registrado: false, motivo: 'techo diario' });
    }

    try {
        await ErrorLog.create({
            huella, mensaje, ruta, pila, origen, navegador,
            usuarios: [req.user._id]
        });
    } catch (e) {
        // Dos móviles con el mismo fallo a la vez: el índice único rechaza el
        // segundo. No es un problema, es justo lo que tiene que pasar.
        if (e.code !== 11000) throw e;
        await ErrorLog.updateOne({ huella }, { $inc: { veces: 1 }, $set: { ultimaVez: new Date() } });
    }

    res.status(202).json({ registrado: true, veces: 1 });
});

module.exports = { registrarError, calcularHuella };
