/** Admin temporal para poder abrir el panel sin usar la cuenta de nadie. */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    await User.deleteOne({ username: 'zzadmin' });
    const u = await User.create({ username: 'zzadmin', email: 'zzadmin@prueba.local', password: 'Prueba1234' });
    u.isAdmin = true;
    await u.save();
    console.log('zzadmin creado, isAdmin=' + u.isAdmin);
    await mongoose.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
