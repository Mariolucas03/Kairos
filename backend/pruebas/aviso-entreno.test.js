const { test, describe } = require('node:test');
const assert = require('node:assert');

const { mensajeDeEntreno, diaDeLaSemanaEnMadrid } = require('../utils/scheduler');

/**
 * EL AVISO DE "HOY TOCA PIERNA"
 *
 * Una notificacion mal mandada no da error en ningun sitio: sale al movil de
 * alguien, molesta, y como mucho se entera uno cuando esa persona apaga los
 * avisos para siempre. Asi que lo que se puede comprobar aqui, se comprueba
 * aqui: el texto y el dia.
 *
 * Lo que NO se prueba —a quien se le manda— vive en la base de datos. Lo que
 * si se prueba es todo lo que puede quedar mal escrito sin que nadie lo vea.
 */

const DIA = 86400000;
const haceDias = (n) => new Date(Date.now() - n * DIA);

describe('El texto del aviso de entreno', () => {

    test('una rutina: dice cual es, cuanto cuesta y cuando fue la ultima', () => {
        const m = mensajeDeEntreno([{
            name: 'Pierna',
            exercises: [{}, {}, {}, {}, {}],
            lastPerformed: haceDias(6)
        }]);

        assert.strictEqual(m.title, '💪 Hoy toca Pierna');
        assert.strictEqual(m.body, '5 ejercicios. La última fue hace 6 días.');
        assert.strictEqual(m.url, '/gym');
    });

    test('"1 ejercicio", no "1 ejercicios"', () => {
        // El singular mal puesto en una notificacion se lee como una app
        // descuidada, y es de las pocas cosas que se ven SIEMPRE.
        const m = mensajeDeEntreno([{ name: 'Core', exercises: [{}], lastPerformed: haceDias(2) }]);
        assert.ok(m.body.startsWith('1 ejercicio.'), m.body);
    });

    test('ayer se dice "ayer", no "hace 1 días"', () => {
        const m = mensajeDeEntreno([{ name: 'Empuje', exercises: [{}, {}], lastPerformed: haceDias(1) }]);
        assert.ok(m.body.includes('ayer'), m.body);
        assert.ok(!m.body.includes('1 días'), m.body);
    });

    test('una rutina sin estrenar no miente diciendo una fecha', () => {
        const m = mensajeDeEntreno([{ name: 'Tiron', exercises: [{}, {}, {}], lastPerformed: null }]);
        assert.strictEqual(m.body, '3 ejercicios. Aún sin estrenar.');
    });

    test('con varias no se listan todas: el titulo se corta en el movil', () => {
        const m = mensajeDeEntreno([
            { name: 'Pierna', exercises: [{}] },
            { name: 'Empuje', exercises: [{}] },
            { name: 'Tiron', exercises: [{}] }
        ]);

        assert.strictEqual(m.title, '💪 Hoy toca Pierna o Empuje');
        assert.ok(m.body.includes('3 rutinas'), m.body);
        // El tercero no cabe en el titulo, pero el cuerpo dice que existe.
        assert.ok(!m.title.includes('Tiron'));
    });

    test('sin rutinas no hay mensaje, y no revienta', () => {
        assert.strictEqual(mensajeDeEntreno([]), null);
        assert.strictEqual(mensajeDeEntreno(null), null);
        assert.strictEqual(mensajeDeEntreno(undefined), null);
    });

    test('el titulo nunca se va de largo para un movil', () => {
        // Android corta el titulo alrededor de los 65 caracteres. Con dos
        // nombres largos hay que seguir cabiendo.
        const m = mensajeDeEntreno([
            { name: 'Pecho y triceps completo', exercises: [{}] },
            { name: 'Espalda y biceps completo', exercises: [{}] }
        ]);
        assert.ok(m.title.length <= 65, 'titulo de ' + m.title.length + ': ' + m.title);
    });
});

describe('El dia de la semana sale de la hora de Madrid', () => {

    test('devuelve un dia valido', () => {
        const d = diaDeLaSemanaEnMadrid();
        assert.ok(Number.isInteger(d) && d >= 0 && d <= 6, 'dia: ' + d);
    });

    test('usa la MISMA numeracion que Date.getDay y que las misiones', () => {
        // 0 = domingo. Si esto se desalineara, "hoy toca Pierna" saldria el dia
        // equivocado y las rutinas guardadas apuntarian a otro dia distinto que
        // el que espera specificDays de las misiones.
        assert.strictEqual(new Date(Date.UTC(2026, 8, 6)).getUTCDay(), 0, 'el 6 de septiembre de 2026 es domingo');

        // Y el de hoy tiene que coincidir con el del reloj salvo en la franja
        // de madrugada en la que UTC va un dia por detras de Madrid.
        const hora = new Date().getUTCHours();
        if (hora >= 3 && hora < 22) {
            assert.strictEqual(diaDeLaSemanaEnMadrid(), new Date().getUTCDay());
        }
    });
});
