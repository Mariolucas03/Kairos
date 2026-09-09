import { descansoInicial, POR_DEFECTO } from './descanso';

/**
 * CON CUANTO DESCANSO ARRANCA UN ENTRENO
 *
 * ⚠️ ESTA PRUEBA NACE DE UN FALLO QUE ENCONTRO EL USUARIO ENTRENANDO.
 *
 * "El cronometro de descanso no sigue el que se pone al crear la rutina."
 *
 * Y era cierto: la pantalla de crear rutinas lo enviaba, el servidor lo
 * guardaba, getRoutines lo devolvia... y el entreno arrancaba con 60 segundos
 * fijos sin mirarlo. Pones 90, entrenas, y el cronometro te da 60 cada vez.
 */

describe('El descanso con el que arranca el entreno', () => {

    test('EL FALLO: sale del que pusiste en la rutina', () => {
        expect(descansoInicial({ defaultRest: 90 }, null)).toBe(90);
        expect(descansoInicial({ defaultRest: 150 }, null)).toBe(150);
    });

    test('un entreno a medias manda sobre la rutina', () => {
        // Si estabas descansando 120 y se te cerro la app, al volver siguen
        // siendo 120: cambiartelo al recuperar la sesion seria perder algo que
        // habias decidido tu a mitad del entreno.
        expect(descansoInicial({ defaultRest: 90 }, { defaultRest: 120 })).toBe(120);
    });

    test('sin nada, 60 segundos', () => {
        // Las rutinas de antes de que el campo existiera.
        expect(descansoInicial({}, null)).toBe(POR_DEFECTO);
        expect(descansoInicial(null, null)).toBe(POR_DEFECTO);
        expect(descansoInicial(undefined, undefined)).toBe(POR_DEFECTO);
    });

    test('un cero no es un descanso: es no tener cronometro', () => {
        // Y un cero guardado no puede tapar el de la rutina.
        expect(descansoInicial({ defaultRest: 90 }, { defaultRest: 0 })).toBe(90);
        expect(descansoInicial({ defaultRest: 0 }, null)).toBe(POR_DEFECTO);
    });

    test('la basura tampoco', () => {
        expect(descansoInicial({ defaultRest: -30 }, null)).toBe(POR_DEFECTO);
        expect(descansoInicial({ defaultRest: 'abc' }, null)).toBe(POR_DEFECTO);
        expect(descansoInicial({ defaultRest: null }, null)).toBe(POR_DEFECTO);
    });

    test('un descanso guardado como texto se entiende igual', () => {
        // localStorage devuelve strings si alguien lo escribio sin parsear.
        expect(descansoInicial({ defaultRest: '90' }, null)).toBe(90);
    });
});
