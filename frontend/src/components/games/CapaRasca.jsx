import { useEffect, useRef } from 'react';

/**
 * LA CAPA PLATEADA DE UN RASCA.
 *
 * ⚠️ ANTES NO SE RASCABA: SE TOCABA.
 *
 * Cada casilla era un botón: lo pulsabas y el símbolo aparecía con un zoom. Lo
 * que define a un rasca es frotar con el dedo y ver cómo se va la capa a tiras,
 * poco a poco, hasta que asoma lo que hay debajo. Sin eso es un "descubre la
 * casilla", que es otro juego.
 *
 * Esto es UN canvas sobre toda la cuadrícula. Se pinta plata con vetas sobre
 * cada casilla y, al arrastrar el dedo, se borra un círculo por donde pasa
 * (`destination-out`). Cada pocos trazos se mide cuánto queda de cada casilla
 * tocada: cuando se ha destapado más de la mitad, se da por rascada, se limpia
 * del todo y se avisa. Un solo canvas y no nueve porque el dedo cruza de una
 * casilla a otra sin levantarse, y con nueve capas cada una capturaría el
 * puntero para sí.
 *
 * `celda(i)` devuelve el rectángulo de cada casilla dentro de la cuadrícula:
 * lo calcula el juego, que sabe cómo la ha maquetado. Así esta capa no se
 * inventa la geometría.
 */

// El contexto 2D, o null. En jsdom (las pruebas) y en algun navegador viejo no
// hay canvas: entonces la capa no se pinta y el juego sigue sin ella.
const contextoDe = (canvas) => {
    try { return canvas?.getContext('2d') || null; } catch { return null; }
};

const RADIO_DEDO = 19;          // px CSS: lo que borra cada pasada
const UMBRAL = 0.55;            // fracción destapada para dar la casilla por rascada
const CADA_CUANTOS_TRAZOS = 6;  // medir en cada trazo sería caro y no hace falta

export default function CapaRasca({ activa, reveladas, celda, onRevelar, onRascar, className = '' }) {
    const canvasRef = useRef(null);
    const estado = useRef({ rascando: false, trazos: 0, ultimo: null, medidas: null, escala: 1 });

    // Pinta la plata en cada casilla que aún no está revelada. Se repinta al
    // activarse (cartón nuevo) y si cambia el tamaño.
    const pintarPlata = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const escala = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(rect.width * escala);
        canvas.height = Math.round(rect.height * escala);
        estado.current.escala = escala;
        estado.current.medidas = { ancho: rect.width, alto: rect.height };

        const ctx = contextoDe(canvas);
        if (!ctx) return;
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);
        if (!activa) return;

        for (let i = 0; i < 9; i++) {
            if (reveladas[i]) continue;
            const c = celda(i, rect.width, rect.height);
            ctx.save();
            ctx.beginPath();
            // `roundRect` no esta en los WebView de Android viejos; sin el
            // respaldo, esto reventaba el componente entero y el rasca
            // desaparecia. Con esquinas rectas se juega igual.
            if (typeof ctx.roundRect === 'function') ctx.roundRect(c.x, c.y, c.ancho, c.alto, 12);
            else ctx.rect(c.x, c.y, c.ancho, c.alto);
            ctx.clip();

            // Plata: un degradado en diagonal con dos brillos, como el de las
            // loterías. Y encima motas, que es lo que hace que parezca metal
            // rascable y no un rectángulo gris.
            const g = ctx.createLinearGradient(c.x, c.y, c.x + c.ancho, c.y + c.alto);
            g.addColorStop(0, '#c9ccd1');
            g.addColorStop(0.35, '#eef0f3');
            g.addColorStop(0.5, '#9ea3aa');
            g.addColorStop(0.72, '#dfe2e6');
            g.addColorStop(1, '#8f949b');
            ctx.fillStyle = g;
            ctx.fillRect(c.x, c.y, c.ancho, c.alto);

            ctx.globalAlpha = 0.18;
            for (let k = 0; k < 90; k++) {
                ctx.fillStyle = k % 2 ? '#ffffff' : '#6b7077';
                ctx.fillRect(c.x + Math.random() * c.ancho, c.y + Math.random() * c.alto, 1 + Math.random() * 2, 1);
            }
            ctx.globalAlpha = 1;

            // El "RASCA AQUÍ" grabado, tenue.
            ctx.fillStyle = 'rgba(60,64,70,0.55)';
            ctx.font = `900 ${Math.max(9, c.ancho * 0.11)}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('RASCA', c.x + c.ancho / 2, c.y + c.alto / 2);
            ctx.restore();
        }
    };

    useEffect(() => {
        pintarPlata();
        // ⚠️ SOLO SI CAMBIA EL ANCHO.
        //
        // En el movil, la barra del navegador se esconde al hacer scroll y eso
        // dispara `resize` con el mismo ancho y otro alto. Repintar ahi volvia
        // a cubrir de plata las casillas a medio rascar: frotabas, se te iba
        // la barra, y la plata volvia. Un cambio de ancho es girar el movil, y
        // eso si obliga a repintar (la cuadricula cambia de tamaño).
        let anchoAnterior = window.innerWidth;
        const alCambiarTamano = () => {
            if (Math.abs(window.innerWidth - anchoAnterior) < 2) return;
            anchoAnterior = window.innerWidth;
            pintarPlata();
        };
        window.addEventListener('resize', alCambiarTamano);
        return () => window.removeEventListener('resize', alCambiarTamano);
        // Se repinta cuando arranca un cartón. Las reveladas se limpian aparte
        // (borrando), no repintando: repintar borraría los trazos a medias.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activa]);

    /** Cuánto queda destapado de una casilla: se muestrea 1 de cada 4 píxeles. */
    const fraccionDestapada = (i) => {
        const canvas = canvasRef.current;
        const { escala, medidas } = estado.current;
        if (!canvas || !medidas) return 0;
        const c = celda(i, medidas.ancho, medidas.alto);
        const ctx = contextoDe(canvas);
        if (!ctx) return 0;
        const datos = ctx.getImageData(
            Math.round(c.x * escala), Math.round(c.y * escala),
            Math.round(c.ancho * escala), Math.round(c.alto * escala)
        ).data;
        let vacios = 0, total = 0;
        for (let p = 3; p < datos.length; p += 16) {   // el alfa de 1 de cada 4 píxeles
            total++;
            if (datos[p] < 40) vacios++;
        }
        return total ? vacios / total : 0;
    };

    const limpiarCelda = (i) => {
        const canvas = canvasRef.current;
        const { medidas } = estado.current;
        if (!canvas || !medidas) return;
        const c = celda(i, medidas.ancho, medidas.alto);
        const ctx = contextoDe(canvas);
        if (!ctx) return;
        ctx.clearRect(c.x - 2, c.y - 2, c.ancho + 4, c.alto + 4);
    };

    const celdaEn = (x, y) => {
        const { medidas } = estado.current;
        if (!medidas) return -1;
        for (let i = 0; i < 9; i++) {
            const c = celda(i, medidas.ancho, medidas.alto);
            if (x >= c.x && x <= c.x + c.ancho && y >= c.y && y <= c.y + c.alto) return i;
        }
        return -1;
    };

    const rascarEn = (x, y) => {
        const canvas = canvasRef.current;
        const ctx = contextoDe(canvas);
        if (!ctx) return;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        // Un círculo blando: el borde se va a medias, como con la uña.
        const g = ctx.createRadialGradient(x, y, RADIO_DEDO * 0.55, x, y, RADIO_DEDO);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, RADIO_DEDO, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const i = celdaEn(x, y);
        if (i < 0 || reveladas[i]) return;
        const e = estado.current;
        e.trazos++;
        if (e.trazos % CADA_CUANTOS_TRAZOS === 0 && fraccionDestapada(i) >= UMBRAL) {
            limpiarCelda(i);
            onRevelar?.(i);
        }
    };

    const posicion = (ev) => {
        const r = canvasRef.current.getBoundingClientRect();
        return [ev.clientX - r.left, ev.clientY - r.top];
    };

    const alBajar = (ev) => {
        if (!activa) return;
        ev.preventDefault();
        estado.current.rascando = true;
        const [x, y] = posicion(ev);
        estado.current.ultimo = [x, y];
        rascarEn(x, y);
        onRascar?.(0.5);
    };

    const alMover = (ev) => {
        if (!activa || !estado.current.rascando) return;
        ev.preventDefault();
        const [x, y] = posicion(ev);
        const [ux, uy] = estado.current.ultimo || [x, y];
        // Entre dos eventos el dedo puede haber saltado un trecho: se rellena
        // con círculos por el camino para que el trazo sea continuo.
        const d = Math.hypot(x - ux, y - uy);
        const pasos = Math.max(1, Math.ceil(d / (RADIO_DEDO * 0.5)));
        for (let k = 1; k <= pasos; k++) rascarEn(ux + (x - ux) * k / pasos, uy + (y - uy) * k / pasos);
        estado.current.ultimo = [x, y];
        onRascar?.(Math.min(d / 40, 1));
    };

    const alSoltar = () => {
        estado.current.rascando = false;
        estado.current.ultimo = null;
        onRascar?.(0);
    };

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full ${activa ? 'cursor-crosshair' : 'pointer-events-none'} ${className}`}
            style={{ touchAction: 'none' }}
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerLeave={alSoltar}
            onPointerCancel={alSoltar}
            aria-label={activa ? 'Rasca con el dedo para descubrir las casillas' : undefined}
        />
    );
}
