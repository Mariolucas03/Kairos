require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const CartaAlta = require('./models/CartaAlta');
const ctrl = require('./controllers/cartaAltaController');
const { borrarUsuarioYSusDatos } = require('./services/borradoService');
const res_ = () => { const r = {}; r.status = c => { r.codigo = c; return r; }; r.json = b => { r.cuerpo = b; return r; }; return r; };
(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    for (const n of ['zzana', 'zzbeto']) { const u = await User.findOne({ username: n }); if (u) await borrarUsuarioYSusDatos(u._id); }
    const ana = await User.create({ username: 'zzana', email: 'a@p.local', password: 'Prueba1234' });
    const beto = await User.create({ username: 'zzbeto', email: 'b@p.local', password: 'Prueba1234' });
    await User.updateOne({ _id: ana._id }, { $set: { gameCoins: 5000, friends: [beto._id] } });
    await User.updateOne({ _id: beto._id }, { $set: { gameCoins: 5000, friends: [ana._id] } });
    // Una partida ya empezada con unas cuantas manos, para ver el panel de conteo lleno
    const r = res_(); await ctrl.crearPartida({ user: { _id: ana._id }, body: { amigoId: beto._id.toString(), apuesta: 100 } }, r);
    const id = r.cuerpo._id;
    await ctrl.responderInvitacion({ user: { _id: beto._id }, params: { id }, body: { respuesta: 'aceptar' } }, res_());
    for (let i = 0; i < 6; i++) {
        await ctrl.levantarCarta({ user: { _id: ana._id }, params: { id } }, res_());
        await ctrl.levantarCarta({ user: { _id: beto._id }, params: { id } }, res_());
    }
    // Y un reto nuevo sin contestar, para ver el buzon
    await ctrl.crearPartida({ user: { _id: beto._id }, body: { amigoId: ana._id.toString(), apuesta: 250 } }, res_());
    console.log('listo: ana/zzbeto con partida de 6 manos + un reto pendiente para Ana');
    await mongoose.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
