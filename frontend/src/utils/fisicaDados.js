/**
 * CÓMO CAE UN DADO.
 *
 * ⚠️ ANTES LOS DADOS ERAN NÚMEROS QUE PARPADEABAN.
 *
 * Un "dado" era una cifra grande que cambiaba al azar cada 80 milisegundos con
 * un desenfoque encima, y al pararse enseñaba el número del servidor. Ni cubo,
 * ni caras, ni caída. Un dado de verdad es un cubo que da vueltas en el aire,
 * cae sobre la mesa, bota dos o tres veces cada vez más bajo y se queda quieto
 * con una cara arriba.
 *
 * Esto describe ese movimiento en función del tiempo. Devuelve, para cada
 * instante, cómo está girado el cubo y a qué altura va. No sabe nada de React.
 *
 * ⚠️ LA CARA LA DECIDE EL SERVIDOR. Esto solo dibuja el camino hasta ella.
 *
 * ⚠️ LAS ORIENTACIONES ESTÁN COMPROBADAS EN EL NAVEGADOR, NO DEDUCIDAS.
 *
 * Los signos de las rotaciones 3D de CSS engañan (el eje Y apunta hacia abajo
 * y el Z hacia el espectador). En vez de razonarlo, se colocaron las seis caras
 * como dice `COLOCACION`, se aplicaron rotaciones candidatas con `DOMMatrix` y
 * se miró qué cara quedaba apuntando al espectador. Lo de abajo es lo que
 * salió. Si se cambia `COLOCACION` hay que repetir la comprobación.
 */

// Dónde va cada cara dentro del cubo. Las opuestas suman 7, como en un dado
// de verdad. `translateZ(var(--m))` la saca a la superficie.
export const COLOCACION = {
    1: 'translateZ(var(--m))',
    6: 'rotateY(180deg) translateZ(var(--m))',
    2: 'rotateY(90deg) translateZ(var(--m))',
    5: 'rotateY(-90deg) translateZ(var(--m))',
    3: 'rotateX(90deg) translateZ(var(--m))',
    4: 'rotateX(-90deg) translateZ(var(--m))'
};

// Con qué `rotateX(x) rotateY(y)` del cubo queda cada cara mirando al
// espectador. El giro en Z va FUERA de estos dos (a la izquierda en el
// transform) porque es el eje que apunta al espectador: girar sobre él no
// cambia qué cara se ve, y por eso puede ser libre.
export const ORIENTACION = {
    1: { x: 0, y: 0 },
    6: { x: 0, y: 180 },
    2: { x: 0, y: -90 },
    5: { x: 0, y: 90 },
    3: { x: -90, y: 0 },
    4: { x: 90, y: 0 }
};

// Los pips de cada cara, en una rejilla de 3x3 (índices 0-8, por filas).
export const PIPS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
};

export const DURACION = 2600;

// La caída: tres toques de mesa. Tantos por uno del tiempo total en que
// aterriza cada vez, y a qué altura sube después (en px, negativa = arriba).
const ATERRIZA = [0.36, 0.60, 0.78];
const ALTURA_INICIAL = -150;
const REBOTA_A = [-46, -14];

const mod360 = (a) => ((a % 360) + 360) % 360;
const frena = (t) => 1 - Math.pow(1 - t, 3);

/**
 * @param {Object} p
 * @param {number} p.cara        1..6, la que dijo el servidor
 * @param {Function} [p.azar]    para poder fijarlo en las pruebas
 * @param {number} [p.retraso]   ms que tarda en salir (el segundo dado va un pelín después)
 * @returns {{ estado(ms), duracion, aterrizajes }}
 *          estado(ms) → { rotX, rotY, rotZ, altura, enElAire }
 */
export const trayectoriaDado = ({ cara, azar = Math.random, retraso = 0 }) => {
    const objetivo = ORIENTACION[cara] || ORIENTACION[1];

    // Cuántas vueltas enteras de adorno, y hacia qué lado. Distintas por eje
    // y por dado para que dos dados no giren igual, que se nota falso.
    const signo = () => (azar() < 0.5 ? -1 : 1);
    const vueltasX = (2 + Math.floor(azar() * 3)) * signo();
    const vueltasY = (2 + Math.floor(azar() * 3)) * signo();
    const vueltasZ = (1 + Math.floor(azar() * 2)) * signo();

    // La cara arriba no depende de Z, así que el dado puede quedarse torcido
    // como uno de verdad: entre -28 y 28 grados.
    const zFinal = (azar() * 56 - 28);

    const finX = objetivo.x + vueltasX * 360;
    const finY = objetivo.y + vueltasY * 360;
    const finZ = zFinal + vueltasZ * 360;

    // El giro termina justo en el último aterrizaje: después de tocar mesa por
    // tercera vez, un dado ya no gira.
    const msUltimoAterrizaje = ATERRIZA[2] * DURACION;

    const altura = (ms) => {
        const t = ms / DURACION;
        if (t <= 0) return ALTURA_INICIAL;
        // Primera caída: desde arriba, acelerando (cae por gravedad).
        if (t < ATERRIZA[0]) {
            const u = t / ATERRIZA[0];
            return ALTURA_INICIAL * (1 - u * u);
        }
        // Dos botes: parábolas que suben hasta REBOTA_A y vuelven a 0.
        for (let i = 0; i < 2; i++) {
            const a = ATERRIZA[i];
            const b = ATERRIZA[i + 1];
            if (t < b) {
                const u = (t - a) / (b - a);          // 0 al despegar, 1 al aterrizar
                return REBOTA_A[i] * 4 * u * (1 - u); // parábola con vértice en u = 0.5
            }
        }
        return 0;
    };

    const estado = (msTotal) => {
        const ms = Math.max(msTotal - retraso, 0);
        const g = frena(Math.min(ms / msUltimoAterrizaje, 1));
        return {
            rotX: finX * g,
            rotY: finY * g,
            rotZ: finZ * g,
            altura: altura(ms),
            enElAire: altura(ms) < -0.5
        };
    };

    return {
        estado,
        duracion: DURACION + retraso,
        // Cuándo toca mesa, para el sonido. En ms desde el arranque.
        aterrizajes: ATERRIZA.map(a => a * DURACION + retraso),
        // Para las pruebas: la orientación exacta a la que tiene que llegar.
        finX, finY, finZ
    };
};

/** ¿Qué cara enseña una rotación dada? La inversa de ORIENTACION, módulo 360. */
export const caraQueEnseña = (rotX, rotY) => {
    const x = mod360(Math.round(rotX));
    const y = mod360(Math.round(rotY));
    for (const [cara, o] of Object.entries(ORIENTACION)) {
        if (mod360(o.x) === x && mod360(o.y) === y) return Number(cara);
    }
    return null;
};
