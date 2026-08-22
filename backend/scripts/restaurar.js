/**
 * RESTAURAR UNA COPIA DE SEGURIDAD
 *
 * Una copia que nunca se ha restaurado no es una copia: es un fichero del que
 * te fias. Esto es la otra mitad de backup.js, y esta pensado para poder
 * PROBARLO sin tocar la base buena.
 *
 * Uso:
 *     node backend/scripts/restaurar.js --desde 2026-08-21_1930 --base kairos_prueba
 *     node backend/scripts/restaurar.js --desde 2026-08-21_1930 --base test --si-encima-de-la-buena
 *
 * Por defecto NO deja escribir en la base que usa la app en produccion: hay que
 * decirlo a proposito con --si-encima-de-la-buena. Restaurar sobre la base viva
 * borra lo que haya ahora, y si alguien ha entrado despues de la copia, ese rato
 * se pierde: no es algo que deba pasar por un dedazo en un nombre.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

const RAIZ = path.join(__dirname, '..', '..', 'backups');

const arg = (nombre) => {
    const i = process.argv.indexOf(nombre);
    return i !== -1 ? process.argv[i + 1] : null;
};

(async () => {
    const desde = arg('--desde');
    const baseDestino = arg('--base');
    const encimaDeLaBuena = process.argv.includes('--si-encima-de-la-buena');

    if (!desde || !baseDestino) {
        console.log('Uso: node backend/scripts/restaurar.js --desde <carpeta> --base <nombreBase>');
        console.log('\nCopias disponibles:');
        if (fs.existsSync(RAIZ)) fs.readdirSync(RAIZ).sort().reverse().forEach(c => console.log('   ' + c));
        else console.log('   (todavia no hay ninguna)');
        process.exit(1);
    }

    const carpeta = path.join(RAIZ, desde);
    if (!fs.existsSync(carpeta)) { console.error('❌ No existe la copia ' + desde); process.exit(1); }

    // Nombre de la base que usa la app ahora mismo
    const uri = process.env.MONGO_URI;
    const baseViva = (uri.split('/').pop().split('?')[0]) || 'test';

    if (baseDestino === baseViva && !encimaDeLaBuena) {
        console.error(`❌ "${baseDestino}" es la base que usa la app en produccion.`);
        console.error('   Si de verdad quieres sobrescribirla, repite con --si-encima-de-la-buena');
        process.exit(1);
    }

    const manifiesto = JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8'));
    console.log(`📥 Restaurando la copia del ${manifiesto.fecha} (${manifiesto.totalDocs} documentos) en la base "${baseDestino}"`);

    const cliente = new MongoClient(uri);
    await cliente.connect();
    const db = cliente.db(baseDestino);

    let total = 0;

    for (const fichero of fs.readdirSync(carpeta)) {
        if (!fichero.endsWith('.json') || fichero === 'manifiesto.json') continue;

        const nombre = fichero.replace(/\.json$/, '');
        const docs = EJSON.parse(fs.readFileSync(path.join(carpeta, fichero), 'utf8'));

        await db.collection(nombre).deleteMany({});
        if (docs.length > 0) await db.collection(nombre).insertMany(docs);

        console.log(`   ${nombre}: ${docs.length}`);
        total += docs.length;
    }

    console.log(`\n✅ Restaurados ${total} documentos en "${baseDestino}"`);
    await cliente.close();
})().catch(e => { console.error('❌ Error restaurando:', e.message); process.exit(1); });
