import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, Clock, Flame, MapPin } from 'lucide-react';

export default function SportWidget({
    workouts = [],
    history = [],
    activityName,
    duration,
    distance,
    calories
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    // --- LÓGICA DE DATOS ---
    let dataList = workouts.length > 0 ? workouts : history;

    if (dataList.length === 0 && (duration || activityName)) {
        dataList = [{
            routineName: activityName,
            duration: duration,
            distance: distance,
            caloriesBurned: calories,
            intensity: 'Media'
        }];
    }

    const hasActivity = dataList.length > 0;
    const selectedActivity = hasActivity ? dataList[activeTabIndex] : null;
    const cardActivity = hasActivity ? dataList[0] : null;

    // --- DATOS TARJETA (Mini) ---
    const cardDuration = cardActivity
        ? (Number(cardActivity.duration) || Number(cardActivity.minutes) || 0)
        : 0;

    let cardName = "";
    if (cardActivity) {
        cardName = cardActivity.routineName
            || cardActivity.activityName
            || cardActivity.name
            || cardActivity.title
            || cardActivity.type
            || "ENTRENO";
    }

    // --- DATOS MODAL (Detalle) ---
    const modalName = selectedActivity?.routineName || cardName;
    const modalDuration = selectedActivity ? (Number(selectedActivity.duration) || 0) : 0;
    const modalDistance = selectedActivity ? (Number(selectedActivity.distance) || 0) : 0;
    const modalKcal = selectedActivity ? (Number(selectedActivity.caloriesBurned) || 0) : 0;
    const modalIntensity = selectedActivity?.intensity || 'Media';

    useEffect(() => {
        if (dataList.length > 0) setActiveTabIndex(0);
    }, [dataList, isOpen]);

    // --- COLORES FLOW "OCEAN BLUE" ---
    const gradientClasses = "from-[#2E3192] to-[#1BFFFF]";
    const shadowColor = "rgba(27, 255, 255, 0.5)";

    return (
        <>
            {/* 1. WIDGET PEQUEÑO (Tarjeta Home) */}
            <div
                onClick={() => setIsOpen(true)}
                className={`
                    h-full w-full relative rounded-[32px] overflow-hidden
                    group cursor-pointer active:scale-[0.98] transition-all duration-200
                    p-[2px] 
                    bg-gradient-to-br ${gradientClasses}
                    shadow-[0_0_20px_${shadowColor}]
                `}
            >
                {/* Añadido 'relative' aquí para el posicionamiento absoluto de los hijos */}
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col relative overflow-hidden z-10">

                    {/* CABECERA */}
                    <div className="px-5 pt-5 flex justify-start z-20 shrink-0">
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none pr-1">
                            DEPORTE
                        </h2>
                    </div>

                    {/* CONTENIDO CENTRAL: DURACIÓN */}
                    <div className="flex-1 flex flex-col items-center justify-center z-20 pb-8">
                        {hasActivity ? (
                            <div className="w-full text-center animate-in zoom-in duration-300">
                                <div className="flex items-baseline justify-center gap-1">
                                    {/* NÚMERO RECTO CON GRADIENTE */}
                                    <span className={`text-7xl font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} drop-shadow-md filter brightness-110 not-italic`}>
                                        {cardDuration}
                                    </span>
                                    {/* UNIDAD MIN RECTA Y BLANCA */}
                                    <span className="text-2xl font-black uppercase text-white tracking-tighter not-italic">
                                        MIN
                                    </span>
                                </div>
                                {/* INDICADOR +1 MÁS */}
                                {dataList.length > 1 && (
                                    <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest block mt-1">
                                        +{dataList.length - 1} ACTIVIDAD EXTRA
                                    </span>
                                )}
                            </div>
                        ) : (
                            /* --- ESTADO VACÍO (0 CON COLOR DEL WIDGET Y FIX DE RECORTE) --- */
                            <div className="w-full text-center animate-in zoom-in duration-300">
                                <div className="flex items-baseline justify-center gap-1">
                                    {/* FIX: 
                                        - Cambiado leading-none a leading-tight para dar altura
                                        - Añadido pb-2 y pr-2 para evitar el recorte del degradado
                                    */}
                                    <span className={`text-7xl font-black tracking-tighter leading-tight text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} drop-shadow-md filter brightness-110 not-italic pb-2 pr-2`}>
                                        0
                                    </span>
                                    <span className="text-2xl font-black uppercase text-white tracking-tighter not-italic">
                                        MIN
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 🔥 INFO INFERIOR: NOMBRE (POSICIONAMIENTO ABSOLUTO) 🔥 */}
                    <div className="absolute bottom-3 right-5 z-20 max-w-[70%] overflow-hidden whitespace-nowrap text-right">
                        <span className="text-xl font-black text-white uppercase tracking-tight leading-none drop-shadow-md block not-italic truncate">
                            {hasActivity ? cardName.toUpperCase() : ""}
                        </span>
                    </div>

                    {/* BARRA INFERIOR (NEÓN AZUL) */}
                    <div className="absolute bottom-0 left-0 w-full h-3 z-10">
                        <div
                            className={`h-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_15px_${shadowColor}] transition-all duration-500 ease-out`}
                            style={{ width: '100%' }}
                        ></div>
                    </div>

                    {/* Luz ambiental */}
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${gradientClasses} opacity-20 z-0`}></div>
                </div>
            </div>

            {/* 2. MODAL DESPLEGABLE (ESTILO LIMPIO) */}
            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                >
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true"></div>

                    <div
                        className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 overflow-hidden max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decoración Fondo */}
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
                        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none bg-gradient-to-bl ${gradientClasses} opacity-10`}></div>

                        {/* Header Modal */}
                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 pr-2">
                                DETALLE <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125`}>SPORT</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* PESTAÑAS */}
                        {dataList.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10 shrink-0 z-10 no-scrollbar">
                                {dataList.map((w, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveTabIndex(idx)}
                                        className={`
                                            px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border uppercase
                                            ${activeTabIndex === idx
                                                ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/20'
                                                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white hover:bg-zinc-800'
                                            }
                                        `}
                                    >
                                        {w.routineName || w.name || `ACTIVIDAD ${idx + 1}`}
                                    </button>
                                ))}
                            </div>
                        )}

                        {hasActivity ? (
                            <div className="flex flex-col gap-4 relative z-10 overflow-y-auto custom-scrollbar pr-1 flex-1">

                                {/* Tarjeta Principal (Resumen) */}
                                <div className="bg-zinc-900/50 p-6 rounded-[24px] border border-cyan-500/20 text-center relative overflow-hidden shrink-0">
                                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientClasses} opacity-5`}></div>

                                    <h3 className="text-3xl font-black text-white uppercase leading-none mb-2">{modalName}</h3>

                                    <div className="flex justify-center items-center gap-2 mb-4">
                                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full uppercase font-bold border border-white/5">
                                            INTENSIDAD: {modalIntensity}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* TIEMPO */}
                                        <div className="bg-black/40 px-4 py-3 rounded-xl border border-white/5 flex flex-col justify-center">
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1 mb-1"><Clock size={10} /> Tiempo</span>
                                            <span className="text-2xl font-black text-white">{modalDuration}<span className="text-sm text-zinc-600 ml-0.5">m</span></span>
                                        </div>
                                        {/* KCAL */}
                                        <div className="bg-black/40 px-4 py-3 rounded-xl border border-white/5 flex flex-col justify-center">
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1 mb-1"><Flame size={10} /> Kcal</span>
                                            <span className="text-2xl font-black text-cyan-400">{modalKcal}</span>
                                        </div>
                                        {/* DISTANCIA */}
                                        <div className="col-span-2 bg-black/40 px-4 py-3 rounded-xl border border-white/5 flex flex-col justify-center">
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1 mb-1"><MapPin size={10} /> Distancia</span>
                                            <span className="text-3xl font-black text-white">{modalDistance > 0 ? modalDistance : '--'} <span className="text-sm text-zinc-600">KM</span></span>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center relative z-10 flex-1">
                                <Activity size={48} className="text-zinc-700 mb-4" />
                                <p className="text-zinc-500 text-sm font-bold uppercase">No hay actividad.</p>
                                <p className="text-zinc-600 text-xs mt-1">¡Sal a moverte y regístralo!</p>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}