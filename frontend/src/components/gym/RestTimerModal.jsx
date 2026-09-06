import { useState, useEffect } from 'react';
import { SkipForward, Timer } from 'lucide-react';

/**
 * EL RIR: CUANTAS REPETICIONES TE QUEDABAN.
 *
 * ⚠️ EL SERVIDOR LO GUARDABA DESDE HACE TIEMPO. NO HABIA DONDE METERLO.
 *
 * `WorkoutLog` tiene `esfuerzo` y `tipoEsfuerzo` desde hace meses, con su
 * validacion en Joi y hasta una prueba llamada "tiene sitio para cuando haya
 * pantalla". Nunca hubo pantalla, asi que el campo llegaba vacio siempre: otro
 * ajuste muerto, como el selector de progresion y el tipo de serie.
 *
 * ⚠️ SOLO RIR. NO SE PREGUNTA ENTRE RIR Y RPE.
 *
 * El servidor acepta los dos, pero elegir escala en cada serie es exactamente
 * la clase de configuracion que ya se quito de crear rutinas por no entenderse.
 * RIR es el que se explica en cinco palabras —"¿cuantas mas podias hacer?"— y
 * el que se contesta sin pensar. Si algun dia hace falta RPE, el hueco esta.
 *
 * ⚠️ Y SE PREGUNTA EN EL DESCANSO.
 *
 * No en la fila de la serie: ahi ya hay kg, repeticiones, el tipo y la marca de
 * hecha, y un control mas la vuelve ilegible. El descanso son dos minutos
 * mirando un numero bajar, es justo cuando te acuerdas de como fue, y un toque
 * no cuesta nada. Es opcional: quien no conteste guarda el entreno igual.
 */
const OPCIONES_RIR = [
    { valor: 0, texto: '0', ayuda: 'Al fallo' },
    { valor: 1, texto: '1', ayuda: 'Quedaba 1' },
    { valor: 2, texto: '2', ayuda: 'Quedaban 2' },
    { valor: 3, texto: '3', ayuda: 'Quedaban 3' },
    { valor: 4, texto: '4+', ayuda: 'Sobraba' }
];

export default function RestTimerModal({ targetTime, initialDefaultRest, onSkip, onUpdateDefaultRest, info, esfuerzo, onEsfuerzo }) {
    const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((targetTime - Date.now()) / 1000)));
    const [localRest, setLocalRest] = useState(initialDefaultRest);

    useEffect(() => {
        const interval = setInterval(() => {
            const diff = Math.ceil((targetTime - Date.now()) / 1000);
            if (diff <= 0) {
                clearInterval(interval);
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                onSkip();
            } else {
                setRemaining(diff);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [targetTime, onSkip]);

    const handleChange = (e) => {
        const val = e.target.value;
        if (val === '') { setLocalRest(''); return; }
        const num = parseInt(val);
        if (!isNaN(num)) {
            setLocalRest(num);
            onUpdateDefaultRest(num);
        }
    };

    return (
        <div className="fixed bottom-32 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 p-4 rounded-[24px] shadow-2xl z-50 ring-1 ring-white/10 animate-in slide-in-from-bottom-5">
            {/* QUÉ VIENE AHORA.

                Esta pantalla se mira quince o veinte veces por sesión, y hasta
                ahora solo tenía un número bajando. Los dos minutos de descanso
                son justo el rato en el que quieres saber qué te toca y cómo fue
                la serie anterior, así que van aquí y no en otro sitio. */}
            {info && (
                <div className="flex items-center justify-between gap-3 pb-2.5 mb-3 border-b border-white/10">
                    <p className="text-[11px] font-black text-white uppercase tracking-tight truncate min-w-0">
                        {info.proximo}
                    </p>
                    {info.hecho && (
                        <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-lg border tabular-nums ${info.cumplida
                            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                            : 'text-zinc-400 border-white/10 bg-white/5'}`}>
                            {info.cumplida ? '✓ ' : ''}{info.hecho}
                        </span>
                    )}
                </div>
            )}

            {/* ¿CUANTAS TE QUEDABAN? Una fila, un toque, y se puede no contestar. */}
            {onEsfuerzo && (
                <div className="pb-3 mb-3 border-b border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.12em] not-italic">
                            ¿Cuántas más podías hacer?
                        </span>
                        {esfuerzo !== undefined && esfuerzo !== null && (
                            <span className="text-[9px] font-bold text-zinc-600">
                                {OPCIONES_RIR.find(o => o.valor === esfuerzo)?.ayuda}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                        {OPCIONES_RIR.map(o => (
                            <button
                                key={o.valor}
                                type="button"
                                onClick={() => onEsfuerzo(esfuerzo === o.valor ? null : o.valor)}
                                aria-label={`${o.texto} repeticiones en reserva: ${o.ayuda}`}
                                aria-pressed={esfuerzo === o.valor}
                                className={`py-2 rounded-xl border text-xs font-black tabular-nums transition-colors ${esfuerzo === o.valor
                                    ? 'bg-yellow-500 border-yellow-500 text-black'
                                    : 'bg-black border-white/[0.08] text-zinc-400 hover:text-white'}`}
                            >
                                {o.texto}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 pl-2">
                <div className="flex flex-col items-center min-w-[60px]">
                    <span className="text-4xl font-black text-white font-mono leading-none tabular-nums">{remaining}</span>
                    <span className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">Segundos</span>
                </div>
                <div className="h-8 w-[1px] bg-zinc-700"></div>
                <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-400 font-bold uppercase mb-1 flex items-center gap-1"><Timer size={10} /> Tiempo fijo</span>
                    <input type="number" inputMode="decimal" value={localRest} onChange={handleChange} className="bg-black border border-zinc-700 rounded-lg w-16 text-center text-sm font-bold text-white py-1 outline-none" />
                </div>
            </div>
            <button onClick={onSkip} className="bg-white text-black px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition-transform">Saltar <SkipForward size={14} /></button>
            </div>
        </div>
    );
}
