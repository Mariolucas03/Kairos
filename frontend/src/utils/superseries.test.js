import { letraDe, grupoDe, siguienteDelGrupo } from './superseries';

/**
 * LAS SUPERSERIES
 *
 * Esta es la prueba que faltaba cuando se escribio la funcion, y se nota: la
 * primera version de `siguienteDelGrupo` preguntaba "¿queda algo por hacer en
 * el grupo?" en vez de "¿va alguien por detras en esta vuelta?". Con esa regla
 * NO SE DESCANSABA NUNCA hasta la ultima serie del ultimo ejercicio, porque
 * mientras quede una vuelta siempre queda algo por hacer.
 *
 * El fallo no daba error, no rompia ninguna pantalla y solo se descubrio
 * releyendo el codigo. Es exactamente el tipo de cosa que una prueba caza y una
 * revision a ojo no.
 *
 * La forma de leer estas pruebas: una superserie es un CIRCULO. A, B, A, B...
 * Entre A y B no se descansa; al cerrar la vuelta, si.
 */

/** Un ejercicio con `hechas` series completadas de `total`. */
const ej = (nombre, superserie, hechas, total) => ({
    name: nombre,
    superserie,
    setsData: Array.from({ length: total }, (_, i) => ({ completed: i < hechas }))
});

describe('letraDe', () => {

    test('normaliza espacios y mayusculas', () => {
        expect(letraDe({ superserie: ' a ' })).toBe('A');
        expect(letraDe({ superserie: 'b' })).toBe('B');
    });

    test('sin letra es cadena vacia, y no revienta con nada', () => {
        expect(letraDe({ superserie: '' })).toBe('');
        expect(letraDe({ superserie: '   ' })).toBe('');
        expect(letraDe({})).toBe('');
        expect(letraDe(undefined)).toBe('');
    });
});

describe('grupoDe: quien va con quien', () => {

    test('dos ejercicios con la misma letra son un grupo', () => {
        const ejs = [ej('Press', 'A', 0, 3), ej('Remo', 'A', 0, 3), ej('Curl', '', 0, 3)];

        expect(grupoDe(ejs, 0)).toEqual([0, 1]);
        expect(grupoDe(ejs, 1)).toEqual([0, 1]);
    });

    test('un ejercicio sin letra no esta en ningun grupo', () => {
        const ejs = [ej('Press', 'A', 0, 3), ej('Remo', 'A', 0, 3), ej('Curl', '', 0, 3)];
        expect(grupoDe(ejs, 2)).toEqual([]);
    });

    test('UNA LETRA SUELTA NO ES UNA SUPERSERIE', () => {
        // Poner "A" a un solo ejercicio y tratarlo como grupo le quitaria el
        // descanso sin motivo: te quedarias sin cronometro entre series y sin
        // saber por que.
        const ejs = [ej('Press', 'A', 0, 3), ej('Curl', '', 0, 3)];
        expect(grupoDe(ejs, 0)).toEqual([]);
    });

    test('los grupos no se mezclan entre si', () => {
        const ejs = [
            ej('Press', 'A', 0, 3), ej('Remo', 'B', 0, 3),
            ej('Fondos', 'A', 0, 3), ej('Curl', 'B', 0, 3)
        ];
        expect(grupoDe(ejs, 0)).toEqual([0, 2]);
        expect(grupoDe(ejs, 1)).toEqual([1, 3]);
    });

    test('un grupo puede tener tres', () => {
        const ejs = [ej('a', 'A', 0, 3), ej('b', 'A', 0, 3), ej('c', 'A', 0, 3)];
        expect(grupoDe(ejs, 1)).toEqual([0, 1, 2]);
    });

    test('no importa que esten separados en la lista', () => {
        const ejs = [ej('a', 'A', 0, 3), ej('suelto', '', 0, 3), ej('b', 'A', 0, 3)];
        expect(grupoDe(ejs, 0)).toEqual([0, 2]);
    });
});

describe('siguienteDelGrupo: la vuelta del circulo', () => {

    test('sin superserie siempre se descansa', () => {
        const ejs = [ej('Press', '', 0, 3), ej('Remo', '', 0, 3)];
        expect(siguienteDelGrupo(ejs, 0)).toBeNull();
    });

    test('acabas la serie 1 de A: toca B, sin descanso', () => {
        const ejs = [ej('Press', 'A', 0, 3), ej('Remo', 'A', 0, 3)];
        expect(siguienteDelGrupo(ejs, 0)).toBe(1);
    });

    test('EL FALLO: acabas la serie 1 de B y la vuelta se cierra — toca descansar', () => {
        // Aqui es donde la primera version se equivocaba. A lleva 1 y B acaba de
        // hacer la suya: van iguales, la vuelta esta cerrada. Con la regla vieja
        // ("¿queda algo por hacer?") devolvia A, porque a A le quedan 2 series,
        // y no se descansaba nunca.
        const ejs = [ej('Press', 'A', 1, 3), ej('Remo', 'A', 0, 3)];
        expect(siguienteDelGrupo(ejs, 1)).toBeNull();
    });

    test('la vuelta entera de dos ejercicios de 3 series', () => {
        // Se recorre el circuito completo comprobando en cada paso si toca
        // descansar. El patron correcto es: encadena, descansa, encadena,
        // descansa, encadena, descansa.
        const pasos = [];
        let a = 0, b = 0;

        for (let vuelta = 0; vuelta < 3; vuelta++) {
            let ejs = [ej('Press', 'A', a, 3), ej('Remo', 'A', b, 3)];
            pasos.push(siguienteDelGrupo(ejs, 0) === null ? 'descanso' : 'encadena');
            a++;

            ejs = [ej('Press', 'A', a, 3), ej('Remo', 'A', b, 3)];
            pasos.push(siguienteDelGrupo(ejs, 1) === null ? 'descanso' : 'encadena');
            b++;
        }

        expect(pasos).toEqual([
            'encadena', 'descanso',
            'encadena', 'descanso',
            'encadena', 'descanso'
        ]);
    });

    test('con tres ejercicios se encadenan los tres antes de descansar', () => {
        // A(0) -> B, B(0) -> C, C(0) -> descanso
        expect(siguienteDelGrupo([ej('a', 'A', 0, 2), ej('b', 'A', 0, 2), ej('c', 'A', 0, 2)], 0)).toBe(1);
        expect(siguienteDelGrupo([ej('a', 'A', 1, 2), ej('b', 'A', 0, 2), ej('c', 'A', 0, 2)], 1)).toBe(2);
        expect(siguienteDelGrupo([ej('a', 'A', 1, 2), ej('b', 'A', 1, 2), ej('c', 'A', 0, 2)], 2)).toBeNull();
    });

    test('el que ya termino sus series se salta', () => {
        // B tiene 2 series y A tiene 4. Cuando B se acaba, A sigue solo: sus
        // vueltas restantes llevan descanso normal.
        const ejs = [ej('Press', 'A', 2, 4), ej('Remo', 'A', 2, 2)];
        expect(siguienteDelGrupo(ejs, 0)).toBeNull();
    });

    test('con series desiguales se sigue al que va por detras', () => {
        // A lleva 3 y B lleva 1: B va muy por detras, asi que al acabar una de A
        // toca B.
        const ejs = [ej('Press', 'A', 3, 5), ej('Remo', 'A', 1, 5)];
        expect(siguienteDelGrupo(ejs, 0)).toBe(1);
    });

    test('el circulo da la vuelta: del ultimo del grupo se pasa al primero', () => {
        // B acaba su serie 1 cuando A todavia no ha hecho ninguna (se empezo por
        // el segundo). Toca A.
        const ejs = [ej('Press', 'A', 0, 3), ej('Remo', 'A', 0, 3)];
        expect(siguienteDelGrupo(ejs, 1)).toBe(0);
    });

    test('`yaContada` para cuando el estado ya lleva la serie sumada', () => {
        // Desde el componente se llama antes de que React aplique el cambio, asi
        // que la serie recien marcada se suma a mano. Si algun dia se llama
        // despues, este parametro evita contarla dos veces.
        const antesDeAplicar = [ej('Press', 'A', 0, 3), ej('Remo', 'A', 0, 3)];
        const yaAplicado = [ej('Press', 'A', 1, 3), ej('Remo', 'A', 0, 3)];

        expect(siguienteDelGrupo(antesDeAplicar, 0)).toBe(1);
        expect(siguienteDelGrupo(yaAplicado, 0, { yaContada: true })).toBe(1);
    });

    test('el ultimo del entreno no manda a nadie', () => {
        const ejs = [ej('Press', 'A', 3, 3), ej('Remo', 'A', 3, 3)];
        expect(siguienteDelGrupo(ejs, 0)).toBeNull();
        expect(siguienteDelGrupo(ejs, 1)).toBeNull();
    });

    test('un ejercicio sin setsData no revienta', () => {
        const ejs = [{ name: 'Roto', superserie: 'A' }, { name: 'Otro', superserie: 'A' }];
        expect(() => siguienteDelGrupo(ejs, 0)).not.toThrow();
    });
});
