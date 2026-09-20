import { useState, useEffect } from 'react';
import { Minus, Plus, RotateCcw } from '../../iconos';
import { Ficha } from './Ficha';

/**
 * CUÁNTO APUESTAS.
 *
 * ⚠️ ANTES NO SE PODÍA ESCRIBIR LA CANTIDAD.
 *
 * En BlackJack, los dados y las tragaperras la apuesta se movía con dos botones
 * de −10 y +10. Para apostar 500 había que pulsar «+» cuarenta y nueve veces. En
 * la Torre eran cuatro cantidades fijas y ninguna otra. Con saldos de miles de
 * fichas eso no es un ajuste fino, es un peaje: la gente acababa apostando 20
 * porque subir era demasiado trabajo.
 *
 * Aquí se escribe el número y ya. Los botones de −/+ se quedan para el toque de
 * ajuste, y debajo hay fichas de verdad que se echan al círculo, como en una
 * mesa: cada una suma lo que vale.
 *
 * ⚠️ EL TOPE SE APLICA AL TECLEAR; EL MÍNIMO, AL SALIR.
 *
 * No es una manía: son dos límites que se comportan distinto.
 *
 * El mínimo NO puede aplicarse tecla a tecla, porque entonces no se podría
 * escribir "100" con un mínimo de 10: al pulsar el "1" el valor sería 1, saltaría
 * a 10, y el resto de lo que escribes se pegaría a eso.
 *
 * El tope SÍ, y tiene que ser así. Si esperase a que sales del campo, un número
 * imposible —999999 con 12.000 fichas— seguiría siendo el valor apostado
 * mientras el campo tuviera el foco, y bastaría con que el botón de jugar no
 * quitase el foco para mandarlo al servidor. Escribiendo de más te quedas
 * clavado en tu saldo, que es justo lo que uno espera de una casilla de apuesta.
 */
export default function SelectorApuesta({
    valor,
    onChange,
    saldo = 0,
    minimo = 10,
    maximo = Infinity,
    paso = 10,
    deshabilitado = false,
    etiqueta = 'Tu apuesta'
}) {
    // Lo que se ve escrito, que puede estar a medias ("" o "3" camino de "300")
    const [texto, setTexto] = useState(String(valor ?? minimo));

    // Si el valor cambia desde fuera (un atajo, o el juego lo recorta al acabar
    // una partida), el campo tiene que seguirlo.
    useEffect(() => { setTexto(String(valor ?? minimo)); }, [valor, minimo]);

    // ⚠️ Y SI PIERDES, LA APUESTA BAJA CONTIGO.
    //
    // El saldo cambia entre manos. Apostabas 500, perdias, te quedaban 200 — y la
    // casilla seguia marcando 500 con el boton de jugar apagado y sin decir por
    // que. Parecia que el juego se habia colgado.
    //
    // Solo hacia ABAJO: subirla sola cuando ganas seria apostar por ti.
    //
    // Y NUNCA con el juego en marcha. Algunos juegos descuentan la apuesta del
    // saldo que enseñan mientras giran; recortar con ese numero cambiaria la
    // apuesta a mitad de jugada, que es peor que el problema que esto arregla.
    useEffect(() => {
        if (deshabilitado) return;
        const techo = Math.max(minimo, Math.min(maximo, saldo));
        if (typeof valor === 'number' && valor > techo) onChange(techo);
    }, [saldo, maximo, minimo, valor, onChange, deshabilitado]);

    const tope = Math.max(minimo, Math.min(maximo, saldo));
    const encajar = (n) => Math.max(minimo, Math.min(tope, Math.floor(n) || minimo));

    const fijar = (n) => {
        const v = encajar(n);
        setTexto(String(v));
        onChange(v);
    };

    const alEscribir = (e) => {
        let limpio = e.target.value.replace(/[^\d]/g, '').slice(0, 9);

        // El tope, ya. Pasarte de tu saldo te deja clavado en tu saldo.
        const n = parseInt(limpio, 10);
        if (Number.isFinite(n) && n > tope) limpio = String(tope);

        setTexto(limpio);

        // ⚠️ Al juego solo le llegan cantidades VÁLIDAS.
        //
        // Mientras escribes "300" pasas por "3", que está por debajo del mínimo.
        // Ese 3 no se manda: el juego se queda con la última cantidad buena que
        // hubiera. Si se mandara, quedaría apostado hasta que el campo perdiera
        // el foco, y bastaría con que el botón de jugar no lo quitase para que
        // saliera hacia el servidor una apuesta de 3.
        //
        // Asi el valor de fuera NUNCA es invalido, dependa o no de que el `blur`
        // llegue a dispararse.
        const salida = parseInt(limpio, 10);
        if (Number.isFinite(salida) && salida >= minimo) onChange(salida);
    };

    const alSalir = () => fijar(parseInt(texto, 10) || minimo);

    // ⚠️ LAS FICHAS SUMAN, NO FIJAN.
    //
    // Antes eran cuatro atajos que ponian la apuesta a 10, 25, 50 o 100. En una
    // mesa de verdad no se "pone 100": se van echando fichas al circulo. Tocar
    // una ficha la echa encima de lo que hay; para empezar de cero esta la de
    // borrar. Y sigue pudiendose escribir el numero tocandolo.
    //
    // Solo las que caben en lo que te queda: enseñar la de 500 a quien tiene
    // 60 fichas es enseñarle una ficha que no puede coger.
    const FICHAS = [10, 25, 50, 100, 500];
    const actual = parseInt(texto, 10) || minimo;
    const fichas = FICHAS.filter(v => v >= minimo && actual + v <= tope);
    const echar = (v) => fijar(actual + v);

    const noLlega = saldo < minimo;

    return (
        <div className={`w-full ${deshabilitado ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-baseline justify-between mb-2 px-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.12em] not-italic">{etiqueta}</span>
                <span className="text-[10px] font-bold text-zinc-600 tabular-nums">
                    Tienes <span className="text-zinc-300">{saldo.toLocaleString('es-ES')}</span>
                </span>
            </div>

            {/* EL CIRCULO DE APUESTA: el tapete con el aro donde se echan las
                fichas. El numero de dentro se toca y se escribe. */}
            <div
                className="relative rounded-2xl border border-white/[0.07] px-2 py-2 flex items-center gap-2"
                style={{
                    background: 'radial-gradient(ellipse at 50% 30%, #14532d 0%, #0b3b1f 60%, #072a16 100%)',
                    boxShadow: 'inset 0 0 24px rgba(0,0,0,0.6), 0 6px 16px rgba(0,0,0,0.5)'
                }}
            >
                <button
                    type="button"
                    onClick={() => fijar(actual - paso)}
                    aria-label="Bajar la apuesta"
                    className="w-10 h-10 shrink-0 rounded-full bg-black/40 border border-white/10 text-zinc-200 flex items-center justify-center active:scale-90 transition-transform"
                >
                    <Minus size={16} />
                </button>

                <div
                    className="flex-1 min-w-0 h-14 rounded-full flex items-center justify-center gap-2"
                    style={{ border: '2px dashed rgba(234,179,8,0.55)', boxShadow: 'inset 0 0 18px rgba(0,0,0,0.45)' }}
                >
                    <Ficha valor={actual} tamano={30} className="shrink-0" />
                    <input
                        type="text"
                        inputMode="numeric"
                        value={texto}
                        onChange={alEscribir}
                        onBlur={alSalir}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        onFocus={(e) => e.target.select()}
                        aria-label="Cantidad apostada"
                        size={Math.max(2, texto.length)}
                        className="min-w-0 bg-transparent text-center text-[26px] font-black text-yellow-400 tabular-nums outline-none leading-none"
                        style={{ width: `${Math.max(2, texto.length) + 0.5}ch`, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                    />
                </div>

                <button
                    type="button"
                    onClick={() => fijar(actual + paso)}
                    aria-label="Subir la apuesta"
                    className="w-10 h-10 shrink-0 rounded-full bg-black/40 border border-white/10 text-zinc-200 flex items-center justify-center active:scale-90 transition-transform"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* LAS FICHAS: se echan al circulo. */}
            <div className="flex items-center justify-between mt-2 px-1">
                <div className="flex items-center gap-1.5">
                    {FICHAS.map(v => {
                        const cabe = fichas.includes(v);
                        return (
                            <button
                                key={v}
                                type="button"
                                onClick={() => cabe && echar(v)}
                                disabled={!cabe}
                                aria-label={`Echar una ficha de ${v}`}
                                className={`rounded-full transition-transform ${cabe ? 'active:scale-90 hover:-translate-y-0.5' : 'opacity-25 grayscale'}`}
                            >
                                <Ficha valor={v} tamano={38} />
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={() => fijar(minimo)}
                    disabled={actual <= minimo}
                    aria-label="Quitar las fichas"
                    className="w-9 h-9 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30"
                >
                    <RotateCcw size={15} />
                </button>
            </div>

            {noLlega && (
                <p className="text-[10px] font-bold text-red-400 mt-2 px-1">
                    No te llegan las fichas para la apuesta mínima ({minimo}).
                </p>
            )}
        </div>
    );
}
