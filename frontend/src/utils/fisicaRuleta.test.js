import { describe, test, expect } from 'vitest';
import {
    trayectoria, separadoresCruzados,
    DURACION, RADIO_PISTA, RADIO_CASILLA
} from './fisicaRuleta';

/**
 * LA FÍSICA DE LA RULETA
 *
 * Todo lo que hace que parezca de verdad —la espiral, los rebotes, la bola en
 * sentido contrario— es adorno alrededor de UNA condición: al final, la bola
 * tiene que estar en la casilla que dijo el servidor. Si eso falla, la ruleta
 * paga un número y enseña otro, que es el peor fallo posible en un juego con
 * fichas.
 *
 * Por eso se prueba con muchos arranques distintos: el ángulo del que parte la
 * rueda depende de la tirada anterior, y el fallo de "se queda en la raya"
 * apareció justo por eso la primera vez.
 */

const SEG = 360 / 37;
const mod360 = (a) => ((a % 360) + 360) % 360;

// Un abanico de casos: distintos arranques y distintas casillas ganadoras.
const casos = [];
for (const ruedaAlEmpezar of [0, 37, -1234.5, 720, 4321]) {
    for (const indice of [0, 1, 18, 36]) {
        casos.push({ ruedaAlEmpezar, bolaAlEmpezar: 11, anguloCasilla: indice * SEG + SEG / 2 });
    }
}

describe('La rueda', () => {

    test('termina con la casilla ganadora arriba, siempre', () => {
        for (const c of casos) {
            const tr = trayectoria(c);
            // casilla + rueda = 0 (mod 360) es "la casilla está en las 12".
            const arriba = mod360(tr.rueda(DURACION) + c.anguloCasilla);
            expect(Math.abs(arriba) < 1e-6 || Math.abs(arriba - 360) < 1e-6).toBe(true);
        }
    });

    test('gira varias vueltas enteras, no un trozo', () => {
        const tr = trayectoria(casos[0]);
        expect(Math.abs(tr.ruedaAlFinal - casos[0].ruedaAlEmpezar)).toBeGreaterThan(3 * 360);
    });

    test('frena: cada vez avanza menos', () => {
        const tr = trayectoria(casos[0]);
        let anterior = Infinity;
        for (let ms = 200; ms <= DURACION; ms += 200) {
            const avance = Math.abs(tr.rueda(ms) - tr.rueda(ms - 200));
            expect(avance).toBeLessThanOrEqual(anterior + 1e-9);
            anterior = avance;
        }
    });
});

describe('La bola', () => {

    test('⚠️ ACABA EN LA CASILLA GANADORA, con cualquier arranque', () => {
        for (const c of casos) {
            const tr = trayectoria(c);
            const b = tr.bola(DURACION);
            // Arriba, que es donde ha acabado la casilla.
            const arriba = mod360(b.angulo);
            expect(Math.min(arriba, 360 - arriba)).toBeLessThan(1e-6);
            expect(b.radio).toBe(RADIO_CASILLA);
        }
    });

    test('va EN SENTIDO CONTRARIO a la rueda', () => {
        const tr = trayectoria(casos[0]);
        const dRueda = tr.rueda(1000) - tr.rueda(0);
        const dBola = tr.bola(1000).angulo - tr.bola(0).angulo;
        // Signos opuestos. Es lo primero que se ve en una ruleta de verdad y lo
        // primero que faltaba en esta.
        expect(Math.sign(dRueda)).toBe(-Math.sign(dBola));
    });

    test('da muchas más vueltas que la rueda', () => {
        const tr = trayectoria(casos[0]);
        const vueltasBola = Math.abs(tr.bola(tr.msAsiento - 1).angulo - tr.bola(0).angulo) / 360;
        const vueltasRueda = Math.abs(tr.rueda(DURACION) - tr.rueda(0)) / 360;
        expect(vueltasBola).toBeGreaterThan(vueltasRueda * 2);
    });

    test('empieza en la pista y va perdiendo velocidad', () => {
        const tr = trayectoria(casos[0]);
        expect(tr.bola(0).radio).toBe(RADIO_PISTA);
        expect(tr.bola(tr.msCaida - 1).radio).toBe(RADIO_PISTA);

        const v0 = tr.bola(200).velocidad;
        const v1 = tr.bola(tr.msCaida).velocidad;
        expect(v1).toBeLessThan(v0);
    });

    test('al caer REBOTA: el radio sube y baja varias veces', () => {
        const tr = trayectoria(casos[0]);
        let subidas = 0;
        let anterior = tr.bola(tr.msCaida).radio;
        let bajando = true;
        for (let ms = tr.msCaida + 10; ms < tr.msAsiento; ms += 10) {
            const r = tr.bola(ms).radio;
            if (bajando && r > anterior + 0.01) { subidas++; bajando = false; }
            if (!bajando && r < anterior - 0.01) bajando = true;
            anterior = r;
        }
        // Una caída en línea recta daría 0. Con rebotes de verdad, varios.
        expect(subidas).toBeGreaterThanOrEqual(2);
    });

    test('nunca se hunde por debajo de la casilla ni se sale de la pista', () => {
        for (const c of casos.slice(0, 5)) {
            const tr = trayectoria(c);
            for (let ms = 0; ms <= DURACION; ms += 25) {
                const r = tr.bola(ms).radio;
                expect(r).toBeGreaterThanOrEqual(RADIO_CASILLA - 1e-9);
                expect(r).toBeLessThanOrEqual(RADIO_PISTA + 1e-9);
            }
        }
    });

    test('una vez asentada, viaja PEGADA a la rueda', () => {
        const tr = trayectoria(casos[3]);
        // Entre dos instantes ya asentada, bola y rueda se mueven exactamente lo
        // mismo. Si no, la bola se despegaría de la casilla en los últimos
        // metros, que es justo cuando más se mira.
        const a = tr.bola(tr.msAsiento + 100);
        const b = tr.bola(tr.msAsiento + 400);
        expect(a.asentada && b.asentada).toBe(true);
        const dBola = b.angulo - a.angulo;
        const dRueda = tr.rueda(tr.msAsiento + 400) - tr.rueda(tr.msAsiento + 100);
        expect(Math.abs(dBola - dRueda)).toBeLessThan(1e-9);
    });

    test('el temblor del rebote no cambia dónde acaba', () => {
        // Justo en el instante de asentarse, con temblor y sin él, la bola tiene
        // que estar en el mismo sitio: el temblor es adorno y muere a cero.
        const tr = trayectoria(casos[7]);
        const enElAsiento = mod360(tr.bola(tr.msAsiento).angulo);
        const casillaAhi = mod360(tr.rueda(tr.msAsiento) + casos[7].anguloCasilla);
        expect(Math.abs(enElAsiento - casillaAhi)).toBeLessThan(1e-6);
    });
});

describe('Los separadores (el clac-clac)', () => {

    test('cruzar de una casilla a la de al lado es un separador', () => {
        expect(separadoresCruzados(3, 12, SEG)).toBe(1);
    });

    test('quedarse dentro de la misma casilla no es ninguno', () => {
        expect(separadoresCruzados(3, 5, SEG)).toBe(0);
    });

    test('un frame largo puede cruzar varios', () => {
        expect(separadoresCruzados(0, SEG * 3 + 1, SEG)).toBe(3);
    });

    test('pasar por el 0/360 cuenta bien, no 36 de golpe', () => {
        // De la última casilla a la primera es UN separador, no dar la vuelta
        // entera al revés.
        expect(separadoresCruzados(358, 2, SEG)).toBe(1);
    });

    test('la bola pasa por muchos separadores y cada vez por menos', () => {
        const tr = trayectoria(casos[0]);
        // Se cuentan cruces por tramo de tiempo: al principio muchos, al final
        // pocos. Es lo que hace que el clac-clac se vaya espaciando.
        const cruces = (desde, hasta) => {
            let n = 0;
            let prev = tr.bola(desde).relativo;
            for (let ms = desde + 16; ms <= hasta; ms += 16) {
                const rel = tr.bola(ms).relativo;
                n += separadoresCruzados(prev, rel, SEG);
                prev = rel;
            }
            return n;
        };
        const alPrincipio = cruces(0, 1000);
        const alFinal = cruces(tr.msAsiento - 1000, tr.msAsiento);
        expect(alPrincipio).toBeGreaterThan(alFinal * 2);
        expect(alFinal).toBeGreaterThan(0);
    });
});
