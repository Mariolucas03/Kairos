/**
 * COPIA DE SEGURIDAD DE LA BASE DE DATOS
 *
 * La base de produccion vive en el plan gratuito de Atlas, que NO hace copias
 * automaticas. Un borrado accidental —o un script mal apuntado— se lleva los
 * usuarios, los entrenos y el historial entero sin vuelta atras. Esto es lo
 * unico que hay entre eso y perderlo todo.
 *
 * Uso:
 *     node backend/scripts/backup.js
 *     node backend/scripts/backup.js --guardar 30      (cuantas copias conservar)
 *
 * Guarda en Kairos_pc/backups/<fecha>/ un fichero por coleccion en formato
 * EJSON, que es JSON pero conservando los tipos de Mongo (ObjectId, Date,
 * Decimal). Con JSON normal los identificadores volverian como texto y la base
 * restaurada estaria rota por dentro aunque pareciera bien.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const RAIZ = path.join(__dirname, '..', '..', 'backups');

// Cuantas copias conservar. Las mas viejas se borran solas: sin esto la carpeta
// crece para siempre y el dia que llene el disco dejaria de haber copias.
const argIdx = process.argv.indexOf('--guardar');
const CONSERVAR = argIdx !== -1 ? parseInt(process.argv[argIdx + 1], 10) || 14 : 14;

const sello = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

(async () => {
    if (!process.env.MONGO_URI) {
        console.error('❌ Falta MONGO_URI en backend/.env');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const nombreBase = mongoose.connection.name;

    const destino = path.join(RAIZ, sello());
    fs.mkdirSync(destino, { recursive: true });

    console.log(`📦 Copiando la base "${nombreBase}" en ${destino}`);

    const colecciones = (await db.listCollections().toArray())
        .map(c => c.name)
        .filter(n => !n.startsWith('system.'));

    const resumen = {};
    let totalDocs = 0;

    for (const nombre of colecciones) {
        const docs = await db.collection(nombre).find({}).toArray();
        fs.writeFileSync(
            path.join(destino, nombre + '.json'),
            EJSON.stringify(docs, null, 2)
        );
        resumen[nombre] = docs.length;
        totalDocs += docs.length;
        console.log(`   ${nombre}: ${docs.length}`);
    }

    // El manifiesto es lo que permite comprobar de un vistazo que una copia esta
    // completa, sin abrir los ficheros uno a uno.
    fs.writeFileSync(
        path.join(destino, 'manifiesto.json'),
        JSON.stringify({ base: nombreBase, fecha: new Date().toISOString(), colecciones: resumen, totalDocs }, null, 2)
    );

    // --- Limpieza de copias viejas ---
    const copias = fs.readdirSync(RAIZ)
        .filter(n => fs.statSync(path.join(RAIZ, n)).isDirectory())
        .sort();

    const sobran = copias.slice(0, Math.max(0, copias.length - CONSERVAR));
    for (const vieja of sobran) {
        fs.rmSync(path.join(RAIZ, vieja), { recursive: true, force: true });
        console.log(`🗑️  Borrada copia antigua: ${vieja}`);
    }

    // --- Segunda copia fuera del disco del proyecto ---
    //
    // Una copia que vive junto a lo que protege no protege de gran cosa: si el
    // disco muere, se va con el. Windows ya trae OneDrive montado y
    // sincronizando, asi que basta con dejar una copia dentro de su carpeta y el
    // solo se encarga de subirla. Sin cuentas nuevas, sin claves y sin coste.
    //
    // La ruta sale de la variable de entorno que pone el propio Windows, asi que
    // esto funciona igual en otro ordenador (y si no hay OneDrive, no pasa nada).
    const carpetaNube = process.env.CARPETA_NUBE || (process.env.OneDrive ? path.join(process.env.OneDrive, 'Kairos-copias') : null);

    if (carpetaNube) {
        try {
            fs.mkdirSync(carpetaNube, { recursive: true });
            fs.cpSync(destino, path.join(carpetaNube, path.basename(destino)), { recursive: true });

            // En la nube se guardan menos: alli lo que importa es tener las
            // ultimas, no el historial entero.
            const enNube = fs.readdirSync(carpetaNube)
                .filter(n => fs.statSync(path.join(carpetaNube, n)).isDirectory())
                .sort();

            for (const vieja of enNube.slice(0, Math.max(0, enNube.length - 7))) {
                fs.rmSync(path.join(carpetaNube, vieja), { recursive: true, force: true });
            }

            console.log('☁️  Copiada tambien a ' + carpetaNube + ' (' + Math.min(enNube.length, 7) + ' copias alli)');
        } catch (e) {
            // Que falle la nube NO puede tumbar la copia local, que ya esta hecha
            console.warn('⚠️  No se pudo copiar a la nube: ' + e.message);
        }
    }

    const mb = (fs.readdirSync(destino).reduce((t, f) => t + fs.statSync(path.join(destino, f)).size, 0) / 1048576).toFixed(2);
    console.log(`\n✅ ${totalDocs} documentos en ${colecciones.length} colecciones (${mb} MB). Copias guardadas: ${Math.min(copias.length, CONSERVAR)}`);

    await mongoose.disconnect();
})().catch(e => { console.error('❌ Error en la copia:', e.message); process.exit(1); });
