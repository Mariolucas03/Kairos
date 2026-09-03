import { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

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
 * Aquí se escribe el número y ya. Los botones se quedan —para el toque de
 * ajuste— y debajo hay atajos: las cantidades de siempre, la mitad, el doble y
 * el todo.
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

    // ⚠️ CUATRO ATAJOS. NI UNO MÁS.
    //
    // La primera versión traía seis cantidades más la mitad, el doble y el todo:
    // nueve botones debajo de una casilla en la que ya puedes escribir cualquier
    // número. Eso no es dar opciones, es tapar la que importa. Si vas a apostar
    // 250 lo escribes; los atajos son para los toques de siempre.
    //
    // Solo los que caben en tu saldo: enseñar "100" a quien tiene 60 fichas es
    // enseñarle un botón que no puede pulsar.
    const rapidos = [10, 25, 50, 100].filter(v => v >= minimo && v <= tope);

    const noLlega = saldo < minimo;

    return (
        <div className={`w-full ${deshabilitado ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-baseline justify-between mb-2 px-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.12em] not-italic">{etiqueta}</span>
                <span className="text-[10px] font-bold text-zinc-600 tabular-nums">
                    Tienes <span className="text-zinc-300">{saldo.toLocaleString('es-ES')}</span>
                </span>
            </div>

            <div className="flex items-center gap-2 bg-black border border-white/[0.08] rounded-2xl p-1.5">
                <button
                    type="button"
                    onClick={() => fijar((parseInt(texto, 10) || minimo) - paso)}
                    aria-label="Bajar la apuesta"
                    className="w-11 h-11 shrink-0 rounded-xl bg-zinc-900 border border-white/[0.06] text-zinc-300 flex items-center justify-center active:scale-90 transition-transform hover:text-white"
                >
                    <Minus size={18} />
                </button>

                <input
                    type="text"
                    inputMode="numeric"
                    value={texto}
                    onChange={alEscribir}
                    onBlur={alSalir}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    onFocus={(e) => e.target.select()}
                    aria-label="Cantidad apostada"
                    className="flex-1 min-w-0 bg-transparent text-center text-2xl font-black text-yellow-500 tabular-nums outline-none py-1"
                />

                <button
                    type="button"
                    onClick={() => fijar((parseInt(texto, 10) || minimo) + paso)}
                    aria-label="Subir la apuesta"
                    className="w-11 h-11 shrink-0 rounded-xl bg-zinc-900 border border-white/[0.06] text-zinc-300 flex items-center justify-center active:scale-90 transition-transform hover:text-white"
                >
                    <Plus size={18} />
                </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5 mt-2">
                {rapidos.map(v => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => fijar(v)}
                        className={`py-2 rounded-xl border text-xs font-black tabular-nums transition-colors ${valor === v
                            ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-500'
                            : 'bg-zinc-900 border-white/[0.06] text-zinc-400 hover:text-white'}`}
                    >
                        {v}
                    </button>
                ))}
            </div>

            {noLlega && (
                <p className="text-[10px] font-bold text-red-400 mt-2 px-1">
                    No te llegan las fichas para la apuesta mínima ({minimo}).
                </p>
            )}
        </div>
    );
}
