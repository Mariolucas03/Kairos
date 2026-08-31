const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
    listarUsuarios, banear, desbanear, restablecerClave,
    estadoDelSistema, lanzarMantenimiento, ajustarSaldo,
    ultimosComentarios, borrarComentario, borrarEntreno,
    notificar,
    fichaUsuario, ajustarStats, borrarCuenta,
    ultimosEntrenos, economia, registroAdmin
} = require('../controllers/adminController');

/**
 * Todo lo de aquí exige ser administrador.
 *
 * El middleware se aplica a NIVEL DE ROUTER y no ruta por ruta: así, cuando se
 * añada un endpoint nuevo, es imposible olvidarse de protegerlo. Un panel de
 * administración con una sola ruta abierta no es un panel protegido.
 */
const soloAdmin = (req, res, next) => {
    if (!req.user?.isAdmin) {
        return res.status(403).json({ message: 'Solo para administradores' });
    }
    next();
};

router.use(protect, soloAdmin);

router.get('/usuarios', listarUsuarios);
router.post('/banear', banear);
router.post('/desbanear', desbanear);
router.post('/restablecer-clave', restablecerClave);
router.post('/ajustar-saldo', ajustarSaldo);
router.post('/ajustar-stats', ajustarStats);

// Ficha completa y borrado en cascada de una cuenta
router.get('/usuario/:id', fichaUsuario);
router.delete('/usuario/:id', borrarCuenta);

// Estado del sistema y tareas programadas a mano
router.get('/estado', estadoDelSistema);
router.post('/mantenimiento', lanzarMantenimiento);

router.get('/comentarios', ultimosComentarios);
router.get('/entrenos', ultimosEntrenos);
router.delete('/comentario/:entrenoId/:comentarioId', borrarComentario);
router.delete('/entreno/:id', borrarEntreno);

router.post('/notificar', notificar);

// Economia y registro de acciones de administrador
router.get('/economia', economia);
router.get('/registro', registroAdmin);

module.exports = router;
