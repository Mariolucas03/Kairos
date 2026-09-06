const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

/**
 * UNA BASE DE DATOS DE VERDAD PARA LAS PRUEBAS.
 *
 * ⚠️ POR QUE HACIA FALTA.
 *
 * Habia 114 pruebas y las tres averias mas gordas se colaron igual: el "3 de 5"
 * de las misiones, el poder de los clanes yendose a negativo y las superseries
 * que no hacian nada. Ninguna de las tres se podia cazar, porque TODAS las
 * pruebas eran de funciones puras y los tres fallos vivian en codigo que habla
 * con la base de datos.
 *
 * El caso del poder de los clanes lo deja claro: para demostrar el fallo hubo
 * que reescribir a mano en JavaScript el contador viejo y comparar. Eso prueba
 * la aritmetica, no el controlador. Si manana alguien vuelve a meter un
 * `$inc: { totalPower: ... }`, la prueba pura sigue en verde.
 *
 * Esto levanta un MongoDB de verdad en memoria: sin instalar nada, sin tocar
 * Atlas y sin red despues de la primera vez. Arranca en unos 6 segundos y se
 * borra solo al terminar.
 */

let servidor = null;

/** Levanta el Mongo en memoria y conecta mongoose. Idempotente. */
const arrancar = async () => {
    if (servidor) return mongoose.connection;

    servidor = await MongoMemoryServer.create();
    await mongoose.connect(servidor.getUri(), { dbName: 'kairos_pruebas' });
    return mongoose.connection;
};

/** Cierra la conexion y tira el servidor. Idempotente. */
const parar = async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (servidor) { await servidor.stop(); servidor = null; }
};

/**
 * Vacia TODAS las colecciones entre pruebas.
 *
 * Se borra el contenido en vez de tirar la base entera: `dropDatabase` se lleva
 * tambien los indices, y los indices son parte de lo que hay que probar —el
 * unico de `clienteId` es lo que impide que un entreno reintentado se guarde
 * dos veces—. Una prueba que corre sin indices no esta probando la app.
 */
const limpiar = async () => {
    const colecciones = await mongoose.connection.db.collections();
    await Promise.all(colecciones.map(c => c.deleteMany({})));
};

/**
 * Un req/res de mentira para llamar a los controladores de Express.
 *
 * Los controladores son `asyncHandler((req, res) => ...)`: no hace falta montar
 * el servidor entero ni pedir por HTTP para probarlos, basta con darles las dos
 * cosas que usan. `res.json` guarda lo enviado y `res.status` encadena, que es
 * todo lo que hacen los controladores de este proyecto.
 *
 * Los errores salen por `throw`, como en produccion (los recoge
 * express-async-handler), asi que una prueba puede comprobar el mensaje con
 * `assert.rejects`.
 */
const fingirPeticion = ({ user, body = {}, params = {}, query = {} } = {}) => {
    const res = {
        statusCode: 200,
        enviado: undefined,
        status(codigo) { this.statusCode = codigo; return this; },
        json(datos) { this.enviado = datos; return this; }
    };
    return { req: { user, body, params, query }, res };
};

module.exports = { arrancar, parar, limpiar, fingirPeticion };
