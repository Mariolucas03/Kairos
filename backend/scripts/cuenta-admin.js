/**
 * CREAR UNA CUENTA DE ADMINISTRACION OCULTA (y borrar cuentas).
 *
 * ⚠️ LA CONTRASEÑA LA ESCRIBES TU, AQUI, Y NO SE GUARDA EN NINGUN SITIO.
 *
 * No se pasa por argumento a proposito: los argumentos quedan en el historial
 * del terminal y en la lista de procesos del sistema. Se teclea cuando el
 * script la pide, no se ve al escribirla, y lo unico que llega a la base de
 * datos es el hash que genera el modelo de usuario (bcrypt). Nadie —ni quien
 * escribio este script, ni quien lea el repositorio, ni quien mire la base de
 * datos— puede leerla despues.
 *
 * La cuenta se crea con isAdmin y oculto: no sale al buscar gente, ni en el
 * ranking global, ni en el mensual, ni cuenta para el percentil del cuerpo.
 *
 * Uso:
 *     node backend/scripts/cuenta-admin.js --crear
 *     node backend/scripts/cuenta-admin.js --crear --usuario Kairos --correo tu@correo.com
 *     node backend/scripts/cuenta-admin.js --clave <usuario>     (cambiarla)
 *     node backend/scripts/cuenta-admin.js --borrar <usuario>
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');
const { borrarUsuarioYSusDatos } = require('../services/borradoService');

const rl = () => readline.createInterface({ input: process.stdin, output: process.stdout });

const preguntar = (texto) => new Promise(resolve => {
    const i = rl();
    i.question(texto, (r) => { i.close(); resolve(r.trim()); });
});

/** Lo mismo, pero sin que se vea lo que se escribe. */
const preguntarOculto = (texto) => new Promise(resolve => {
    const i = rl();
    const alEscribir = (char) => {
        if (['\n', '\r', '\u0004'].includes(char)) return;
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(texto + '*'.repeat(i.line.length));
    };
    process.stdin.on('data', alEscribir);
    i.question(texto, (r) => {
        process.stdin.removeListener('data', alEscribir);
        process.stdout.write('\n');
        i.close();
        resolve(r.trim());
    });
});

const arg = (n) => {
    const i = process.argv.indexOf(n);
    return i !== -1 ? (process.argv[i + 1] || '').trim() : null;
};

const pedirClave = async () => {
    const clave = await preguntarOculto('Contraseña (no se ve al escribir): ');
    if (clave.length < 6) { console.log('❌ Al menos 6 caracteres.'); return null; }
    const otra = await preguntarOculto('Repítela: ');
    if (clave !== otra) { console.log('❌ No coinciden.'); return null; }
    return clave;
};

const crear = async () => {
    // El nombre y el correo pueden venir por argumento (no son secretos); la
    // contraseña NUNCA, que los argumentos quedan en el historial del terminal.
    const nombre = arg('--usuario') || await preguntar('Nombre de usuario (máx. 8): ');
    if (!nombre || nombre.length > 8) return console.log('❌ El nombre tiene que tener entre 1 y 8 caracteres.');
    if (await User.findOne({ username: new RegExp('^' + nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') })) {
        return console.log('❌ Ya existe un usuario con ese nombre.');
    }

    const email = arg('--correo') || await preguntar('Correo: ');
    if (!email.includes('@')) return console.log('❌ Ese correo no vale.');
    if (await User.findOne({ email: email.toLowerCase() })) return console.log('❌ Ya hay una cuenta con ese correo.');

    const clave = await pedirClave();
    if (!clave) return;

    // El hash lo hace el pre('save') del modelo; aqui nunca se guarda el texto
    await User.create({
        username: nombre,
        email,
        password: clave,
        isAdmin: true,
        oculto: true,
        coins: 0,
        gameCoins: 0,
        level: 1,
        hp: 100,
        lives: 100,
        streak: { current: 0, lastLogDate: new Date(0) }
    });

    // Se comprueba aquí mismo que con esa contraseña se entra: si algo fallara
    // al cifrarla, mejor saberlo ahora y no al quedarse fuera de la app.
    const recien = await User.findOne({ username: nombre }).select('+password');
    if (!(await recien.comparePassword(clave))) {
        console.log('❌ Algo ha ido mal: la contraseña guardada no coincide. NO borres la cuenta vieja.');
        return;
    }

    console.log('\n✅ Cuenta creada y comprobada: ' + nombre);
    console.log('   👑 Administrador');
    console.log('   🙈 Oculta: no sale al buscar, ni en los rankings, ni cuenta para el percentil.');
    console.log('   🔒 La contraseña solo la sabes tú: en la base de datos está cifrada.');
};

const cambiarClave = async (nombre) => {
    const limpio = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({ username: new RegExp('^' + limpio + '$', 'i') }).select('+password username');
    if (!user) return console.log('❌ No existe ningún usuario llamado "' + nombre + '"');
    const clave = await pedirClave();
    if (!clave) return;
    user.password = clave;      // el modelo la cifra al guardar
    await user.save();
    console.log('✅ Contraseña cambiada para ' + user.username);
};

const borrar = async (nombre) => {
    const limpio = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({ username: new RegExp('^' + limpio + '$', 'i') }).select('username level coins gameCoins isAdmin');
    if (!user) return console.log('❌ No existe ningún usuario llamado "' + nombre + '"');

    // ⚠️ QUEDARSE SIN ADMINISTRADOR NO SE ARREGLA DESDE LA APP: no hay ninguna
    // ruta que reparta permisos, a propósito. Si esta es la última cuenta de
    // administración, primero se crea la nueva y se comprueba que entra.
    if (user.isAdmin && (await User.countDocuments({ isAdmin: true, _id: { $ne: user._id } })) === 0) {
        console.log('🚫 ' + user.username + ' es el ÚNICO administrador que hay.');
        console.log('   Crea antes la cuenta nueva:  node backend/scripts/cuenta-admin.js --crear');
        console.log('   Entra con ella en la app, y luego vuelve a borrar esta.');
        return;
    }

    console.log('\n⚠️  VAS A BORRAR ' + user.username + ' (nivel ' + user.level + ', ' + user.coins + ' monedas, ' + user.gameCoins + ' fichas).');
    console.log('   Se borran TODOS sus entrenos, comidas, rutinas, misiones y publicaciones.');
    console.log('   No se puede deshacer y no hay papelera.\n');
    const confirma = await preguntar('Escribe el nombre exacto para confirmar: ');
    if (confirma !== user.username) return console.log('🚫 Cancelado: el nombre no coincide.');

    const resumen = await borrarUsuarioYSusDatos(user._id);
    console.log('🗑️  Borrada. ' + JSON.stringify(resumen));
};

(async () => {
    await mongoose.connect(process.env.MONGO_URI);

    if (process.argv.includes('--crear')) await crear();
    else if (arg('--clave')) await cambiarClave(arg('--clave'));
    else if (arg('--borrar')) await borrar(arg('--borrar'));
    else {
        console.log('Uso:');
        console.log('  node backend/scripts/cuenta-admin.js --crear [--usuario <nombre>] [--correo <correo>]');
        console.log('  node backend/scripts/cuenta-admin.js --clave <usuario>');
        console.log('  node backend/scripts/cuenta-admin.js --borrar <usuario>');
    }

    await mongoose.disconnect();
})().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
