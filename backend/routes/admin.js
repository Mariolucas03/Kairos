const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
    listarUsuarios, banear, desbanear,
    ultimosComentarios, borrarComentario, borrarEntreno,
    notificar
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

router.get('/comentarios', ultimosComentarios);
router.delete('/comentario/:entrenoId/:comentarioId', borrarComentario);
router.delete('/entreno/:id', borrarEntreno);

router.post('/notificar', notificar);

module.exports = router;
