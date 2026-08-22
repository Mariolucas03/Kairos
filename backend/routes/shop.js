const express = require('express');
const router = express.Router();
const { getShopItems, createCustomReward, buyItem, useItem, seedShop, exchangeCurrency } = require('../controllers/shopController');
const protect = require('../middleware/authMiddleware');
const { protectCron } = require('../middleware/cronMiddleware');

router.get('/', protect, getShopItems);
// ⚠️ Los seeds NO son rutas de usuario: reescriben catalogos enteros. El de la
// tienda hacia deleteMany de todo el catalogo, asi que cualquiera con la sesion
// abierta podia dejar sin objetos a TODOS los usuarios de una peticion. Van con
// el CRON_SECRET, como los crons: son mantenimiento, no funcionalidad.
router.post('/seed', protectCron, seedShop);
router.post('/create', protect, createCustomReward);
router.post('/buy', protect, buyItem);
router.post('/use', protect, useItem);
router.post('/exchange', protect, exchangeCurrency); // <--- NUEVA RUTA

module.exports = router;