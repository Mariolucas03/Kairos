const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar, fingirPeticion } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const Routine = require('../models/Routine');
const WorkoutLog = require('../models/WorkoutLog');
const DailyLog = require('../models/DailyLog');
const { getConstanciaPorDia, getFuerzaRelativa } = require('../controllers/gymController');
const { unaRepeticionMaxima } = require('../utils/fuerza');

/**
 * LOS DIAS QUE DICES QUE ENTRENAS, Y CUANTAS VECES TU PESO MUEVES
 *
 * Dos datos que la app tenia guardados por separado y nunca habia cruzado: los
 * dias que la rutina dice que tocan, y las fechas de los entrenos; el peso
 * corporal del diario, y los kilos de las series.
 *
 * Se prueban contra base de datos porque el fallo posible no es de aritmetica:
 * es contar el dia equivocado. Un entreno de las 23:30 de un lunes se guarda
 * como martes en UTC, y en Render el proceso va en UTC.
 */

let siguiente = 0;
const crearUsuario = async () => {
    siguiente++;
    return User.create({
        username: `constante${siguiente}`,
        email: `constante${siguiente}@kairos.test`,
        password: 'da-igual'
    });
};

/** El lunes de hace `hace` semanas, a las 18:00 de Madrid. */
const lunesDeHace = (semanas) => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    d.setDate(d.getDate() - semanas * 7);
    // Retrocede hasta el lunes
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
    return d;
};

const entreno = (userId, fecha, ejercicios = {}) => WorkoutLog.create({
    user: userId,
    type: 'gym',
    routineName: 'Prueba',
    duration: 3600,
    date: fecha,
    exercises: Object.entries(ejercicios).map(([name, series]) => ({
        name,
        muscle: 'Pecho',
        sets: series.map(([weight, reps]) => ({ weight, reps }))
    }))
});

const pedir = async (fn, user, query = {}) => {
    const p = fingirPeticion({ user, query });
    await fn(p.req, p.res);
    return p.res.enviado;
};

describe('Constancia: los dias que dices contra los que vas', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    test('solo se miran los dias que tu rutina dice que tocan', async () => {
        const user = await crearUsuario();
        // 1 = lunes, 5 = viernes
        await Routine.create({ user: user._id, name: 'Torso', dias: [1, 5] });

        const datos = await pedir(getConstanciaPorDia, user);

        assert.strictEqual(datos.sinPlan, false);
        assert.deepStrictEqual(datos.dias.map(d => d.nombre), ['Lunes', 'Viernes']);
    });

    test('EL DATO: los lunes vas y los viernes no', async () => {
        const user = await crearUsuario();
        await Routine.create({ user: user._id, name: 'Torso', dias: [1, 5] });

        // Cuatro lunes seguidos, ningun viernes
        for (let i = 1; i <= 4; i++) await entreno(user._id, lunesDeHace(i));

        const datos = await pedir(getConstanciaPorDia, user, { semanas: '8' });

        const lunes = datos.dias.find(d => d.nombre === 'Lunes');
        const viernes = datos.dias.find(d => d.nombre === 'Viernes');

        assert.strictEqual(lunes.hechos, 4);
        assert.strictEqual(viernes.hechos, 0);
        assert.strictEqual(viernes.porcentaje, 0);
        assert.ok(lunes.porcentaje > viernes.porcentaje);
    });

    test('los dias de VARIAS rutinas se juntan sin repetirse', async () => {
        const user = await crearUsuario();
        await Routine.create({ user: user._id, name: 'Torso', dias: [1, 3] });
        await Routine.create({ user: user._id, name: 'Pierna', dias: [3, 5] });

        const datos = await pedir(getConstanciaPorDia, user);

        assert.deepStrictEqual(datos.dias.map(d => d.dia), [1, 3, 5], 'el miercoles no puede salir dos veces');
    });

    test('sin dias en ninguna rutina se DICE, no se devuelve una tabla de ceros', async () => {
        // Una tabla a cero pareceria que fallas siempre, cuando lo que pasa es
        // que no has puesto dias.
        const user = await crearUsuario();
        await Routine.create({ user: user._id, name: 'Cuando pueda', dias: [] });

        const datos = await pedir(getConstanciaPorDia, user);

        assert.strictEqual(datos.sinPlan, true);
        assert.deepStrictEqual(datos.dias, []);
    });

    test('nunca se puede haber ido mas veces de las que cayo el dia', async () => {
        // Dos entrenos el mismo lunes no son dos lunes.
        const user = await crearUsuario();
        await Routine.create({ user: user._id, name: 'Torso', dias: [1] });

        const unLunes = lunesDeHace(1);
        await entreno(user._id, unLunes);
        await entreno(user._id, new Date(unLunes.getTime() + 3600000));

        const datos = await pedir(getConstanciaPorDia, user, { semanas: '2' });
        const lunes = datos.dias[0];

        assert.ok(lunes.hechos <= lunes.posibles,
            `${lunes.hechos} de ${lunes.posibles} es imposible`);
        assert.ok(lunes.porcentaje <= 100);
    });

    test('el periodo esta acotado', async () => {
        const user = await crearUsuario();
        await Routine.create({ user: user._id, name: 'Torso', dias: [1] });

        assert.strictEqual((await pedir(getConstanciaPorDia, user, { semanas: '999' })).semanas, 52);
        assert.strictEqual((await pedir(getConstanciaPorDia, user, { semanas: '1' })).semanas, 2);
        assert.strictEqual((await pedir(getConstanciaPorDia, user, {})).semanas, 8);
    });

    test('la rutina de otro no cuenta como tuya', async () => {
        const yo = await crearUsuario();
        const otro = await crearUsuario();
        await Routine.create({ user: otro._id, name: 'Suya', dias: [2] });

        assert.strictEqual((await pedir(getConstanciaPorDia, yo)).sinPlan, true);
    });
});

describe('Fuerza relativa: cuantas veces tu peso mueves', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    const apuntarPeso = (userId, kg) => DailyLog.create({
        user: userId,
        date: new Date().toISOString().slice(0, 10),
        weight: kg
    });

    test('100 kg de 1RM con 80 de peso corporal son 1,25 veces', async () => {
        const user = await crearUsuario();
        await apuntarPeso(user._id, 80);
        await entreno(user._id, new Date(), { 'Press Banca': [[100, 1]] });

        const datos = await pedir(getFuerzaRelativa, user);

        assert.strictEqual(datos.pesoCorporal, 80);
        assert.strictEqual(datos.ejercicios[0].nombre, 'Press Banca');
        assert.strictEqual(datos.ejercicios[0].rm1, 100);
        assert.strictEqual(datos.ejercicios[0].veces, 1.25);
    });

    test('SIN PESO CORPORAL SE DICE, no se calcula con un peso inventado', async () => {
        // La pantalla puede invitar a apuntarlo; un numero sacado de la nada
        // seria peor que no enseñar ninguno.
        const user = await crearUsuario();
        await entreno(user._id, new Date(), { 'Press Banca': [[100, 5]] });

        const datos = await pedir(getFuerzaRelativa, user);

        assert.strictEqual(datos.sinPeso, true);
        assert.deepStrictEqual(datos.ejercicios, []);
    });

    test('se queda con la MEJOR serie de cada ejercicio', async () => {
        const user = await crearUsuario();
        await apuntarPeso(user._id, 100);
        await entreno(user._id, new Date(), {
            'Sentadilla': [[100, 5], [140, 3], [120, 4]]
        });

        const datos = await pedir(getFuerzaRelativa, user);

        // 140 x (1 + 3/30) = 154
        assert.strictEqual(datos.ejercicios[0].rm1, 154);
        assert.strictEqual(datos.ejercicios[0].veces, 1.54);
    });

    test('viene ordenado por el que mas peso relativo mueve', async () => {
        const user = await crearUsuario();
        await apuntarPeso(user._id, 100);
        await entreno(user._id, new Date(), {
            'Press Banca': [[100, 1]],
            'Peso Muerto': [[180, 1]],
            'Curl': [[30, 1]]
        });

        const datos = await pedir(getFuerzaRelativa, user);

        assert.deepStrictEqual(datos.ejercicios.map(e => e.nombre),
            ['Peso Muerto', 'Press Banca', 'Curl']);
    });

    test('los de peso corporal no entran: no tienen 1RM', async () => {
        const user = await crearUsuario();
        await apuntarPeso(user._id, 75);
        await entreno(user._id, new Date(), {
            'Dominadas': [[0, 12]],
            'Press Banca': [[80, 5]]
        });

        const datos = await pedir(getFuerzaRelativa, user);

        assert.deepStrictEqual(datos.ejercicios.map(e => e.nombre), ['Press Banca']);
    });

    test('una serie de mas de 12 repeticiones no estima nada', async () => {
        // Epley se dispara ahi. Si esa fuera la unica serie del ejercicio, el
        // ejercicio no sale, que es lo correcto.
        const user = await crearUsuario();
        await apuntarPeso(user._id, 75);
        await entreno(user._id, new Date(), { 'Extensiones': [[40, 20]] });

        assert.deepStrictEqual((await pedir(getFuerzaRelativa, user)).ejercicios, []);
    });

    test('usa el peso corporal MAS RECIENTE', async () => {
        const user = await crearUsuario();
        await DailyLog.create({ user: user._id, date: '2026-01-01', weight: 95 });
        await DailyLog.create({ user: user._id, date: '2026-09-01', weight: 80 });
        await entreno(user._id, new Date(), { 'Press Banca': [[100, 1]] });

        const datos = await pedir(getFuerzaRelativa, user);

        assert.strictEqual(datos.pesoCorporal, 80, 'el de enero ya no vale');
    });
});

describe('El 1RM del servidor cuenta igual que el del movil', () => {

    test('mismos numeros y mismos limites', () => {
        // ⚠️ ESTABA ESCRITA TRES VECES Y UNA NO SE PARECIA A LAS OTRAS.
        //
        // Vivia copiada en getExerciseHistory (la grafica del perfil), en
        // getFuerzaRelativa y en el movil. La del perfil NO cortaba por encima
        // de 12 repeticiones, asi que 40 kg x 15 salia alli como un "PR" de 60
        // kg mientras estadisticas decia que no se podia estimar.
        //
        // Ahora el servidor tiene una sola (utils/fuerza.js). La del movil sigue
        // aparte porque es otro paquete y no puede importar de aqui; esta prueba
        // fija las dos a los mismos valores.
        assert.strictEqual(unaRepeticionMaxima(80, 10), 107);
        assert.strictEqual(unaRepeticionMaxima(100, 1), 100);
        assert.strictEqual(unaRepeticionMaxima(60, 12), 84);
        assert.strictEqual(unaRepeticionMaxima(60, 13), null);
        assert.strictEqual(unaRepeticionMaxima(0, 10), null);
    });
});
