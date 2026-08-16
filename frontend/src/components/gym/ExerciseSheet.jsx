import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Dumbbell, Loader2 } from 'lucide-react';
import api from '../../services/api';

/**
 * Ficha de un ejercicio: GIF de ejecución, músculos y pasos.
 *
 * El GIF y la miniatura se sirven desde el CDN de jsDelivr (catálogo
 * ExerciseGymGifsDB), no desde nuestro backend: no ocupan nada en la base de
 * datos y llegan por una red de reparto.
 *
 * Se le puede pasar el ejercicio entero (`exercise`), su id (`exerciseId`) o
 * sólo su nombre (`exerciseName`). Lo del nombre es para el entreno en curso:
 * las rutinas guardan los ejercicios como subdocumentos con nombre y músculo,
 * sin referencia al catálogo, así que ahí no hay id que pasar.
 *
 * Las instrucciones NO viajan en el listado —serían 5 frases por cada uno de
 * los 1291—, así que si faltan se piden aquí.
 */
export default function ExerciseSheet({ exercise, exerciseId, exerciseName, onClose }) {
    const [ficha, setFicha] = useState(exercise || null);
    const [cargando, setCargando] = useState(!exercise);
    const [gifRoto, setGifRoto] = useState(false);
    const [noEncontrado, setNoEncontrado] = useState(false);

    const id = exerciseId || exercise?._id;
    const faltanPasos = !ficha?.instructions?.length;

    useEffect(() => {
        if (ficha && !faltanPasos) return;
        if (!id && !exerciseName) return;

        let vivo = true;
        setCargando(true);

        const peticion = id
            ? api.get(`/gym/exercises/${id}`).then(r => r.data)
            : api.get('/gym/exercises', { params: { q: exerciseName } }).then(r => {
                const lista = r.data || [];
                const exacto = lista.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
                const elegido = exacto || lista[0];
                // El listado no trae instrucciones: si hemos llegado por nombre,
                // hace falta una segunda petición para la ficha completa.
                return elegido ? api.get(`/gym/exercises/${elegido._id}`).then(r2 => r2.data) : null;
            });

        peticion
            .then(datos => {
                if (!vivo) return;
                if (datos) setFicha(datos); else setNoEncontrado(true);
            })
            .catch(() => { if (vivo) setNoEncontrado(true); })
            .finally(() => { if (vivo) setCargando(false); });

        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, exerciseName]);

    // Un ejercicio propio del usuario no tiene ficha en el catálogo: mejor no
    // abrir un panel vacío.
    if (!ficha && !cargando) {
        if (noEncontrado) return createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md p-6" onClick={onClose}>
                <div className="bg-[#09090b] border border-zinc-800 rounded-[24px] p-6 text-center max-w-xs">
                    <Dumbbell className="mx-auto text-zinc-700 mb-3" size={28} />
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-4">
                        No hay demostración de "{exerciseName || exercise?.name}"
                    </p>
                    <button onClick={onClose} className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2 rounded-xl text-[11px] font-black uppercase">
                        Cerrar
                    </button>
                </div>
            </div>, document.body
        );
        return null;
    }

    const secundarios = (ficha?.secondary || []).filter(s => s !== ficha?.muscle);
    const hayGif = ficha?.gif && !gifRoto;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-[#09090b] w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] border border-zinc-800 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">

                <div className="flex justify-between items-start gap-3 p-5 pb-3 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight leading-tight break-words">
                            {ficha?.name}
                        </h2>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">
                            {ficha?.muscle}
                            {ficha?.equipment && <span className="text-zinc-700"> · {ficha.equipment}</span>}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-zinc-800 shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar px-5 pb-5 space-y-4">
                    {/* GIF. Fondo blanco a propósito: los del catálogo vienen
                        recortados sobre blanco y en oscuro se ven sucios. */}
                    <div className="rounded-[24px] overflow-hidden border border-zinc-800 bg-white aspect-square flex items-center justify-center">
                        {cargando && !ficha?.gif ? (
                            <Loader2 className="animate-spin text-zinc-400" size={28} />
                        ) : hayGif ? (
                            <img
                                src={ficha.gif}
                                alt={ficha.name}
                                className="w-full h-full object-contain"
                                onError={() => setGifRoto(true)}
                            />
                        ) : (
                            <div className="text-center px-6">
                                <Dumbbell className="mx-auto text-zinc-300 mb-2" size={32} />
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                                    Sin demostración para este ejercicio
                                </p>
                            </div>
                        )}
                    </div>

                    {secundarios.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                                También trabaja
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {secundarios.map(s => (
                                    <span key={s} className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-zinc-900 text-zinc-400 border border-zinc-800">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {ficha?.instructions?.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                                Ejecución
                            </p>
                            <ol className="space-y-2">
                                {ficha.instructions.map((paso, i) => (
                                    <li key={i} className="flex gap-3">
                                        <span className="shrink-0 w-5 h-5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-black text-zinc-500 flex items-center justify-center mt-0.5">
                                            {i + 1}
                                        </span>
                                        <span className="text-[13px] text-zinc-300 leading-snug">{paso}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {cargando && faltanPasos && (
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wide text-center">
                            Cargando ejecución...
                        </p>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
