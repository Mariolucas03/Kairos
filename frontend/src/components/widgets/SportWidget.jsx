import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, Clock, Flame, MapPin, Plus } from 'lucide-react';
import WidgetCard, { WidgetStat, WIDGET_ACCENTS } from '../common/WidgetCard';
import SportsTab from '../gym/SportsTab';

/**
 * EL DEPORTE DEL DIA.
 *
 * ⚠️ Y AQUI SE APUNTA, ademas de verse.
 *
 * Registrar cualquier deporte estaba en una pestaña "Otros" dentro de la seccion
 * de gimnasio, entre las rutinas y el mapa muscular. No pintaba nada ahi: nadar
 * o salir en bici no tiene que ver con las rutinas ni con los rangos de cada
 * musculo, y encima obligaba a irse al Gym para apuntar algo que ya tenia su
 * sitio en el home. Ahora se apunta desde aqui, que es donde luego lo miras.
 */
export default function SportWidget({
    workouts = [],
    history = [],
    activityName,
    duration,
    distance,
    calories,
    onSaved,
    showToast
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [apuntando, setApuntando] = useState(false);
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const accent = WIDGET_ACCENTS.sport;

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

    const cardDuration = cardActivity
        ? (Number(cardActivity.duration) || Number(cardActivity.minutes) || 0)
        : 0;

    let cardName = '';
    if (cardActivity) {
        cardName = cardActivity.routineName
            || cardActivity.activityName
            || cardActivity.name
            || cardActivity.title
            || cardActivity.type
            || 'ENTRENO';
    }

    const cardKcal = cardActivity ? (Number(cardActivity.caloriesBurned) || 0) : 0;

    const modalName = selectedActivity?.routineName || cardName;
    const modalDuration = selectedActivity ? (Number(selectedActivity.duration) || 0) : 0;
    const modalDistance = selectedActivity ? (Number(selectedActivity.distance) || 0) : 0;
    const modalKcal = selectedActivity ? (Number(selectedActivity.caloriesBurned) || 0) : 0;
    const modalIntensity = selectedActivity?.intensity || 'Media';

    useEffect(() => {
        if (dataList.length > 0) setActiveTabIndex(0);
    }, [dataList, isOpen]);

    // Subtítulo: nombre + kcal, y el aviso de sesiones extra si las hay
    const subtitle = hasActivity
        ? [cardName.toUpperCase(), cardKcal > 0 ? `${cardKcal} KCAL` : null]
            .filter(Boolean).join(' · ')
        : 'SIN ACTIVIDAD';

    return (
        <>
            <WidgetCard
                accent={accent}
                onClick={() => setIsOpen(true)}
                className="h-full flex flex-col justify-between"
                label="DEPORTE"
            >
                <div className="relative z-10 mt-auto pt-3">
                    <WidgetStat value={cardDuration} unit="MIN" accent={accent} size="text-[40px]" />
                    <div className="mt-2.5 text-[10px] font-black text-zinc-400 uppercase tracking-[0.1em] truncate not-italic">
                        {subtitle}
                        {dataList.length > 1 && (
                            <span style={{ color: accent }}> · +{dataList.length - 1}</span>
                        )}
                    </div>
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }} className="fixed left-0 right-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />

                    <div
                        className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 overflow-hidden max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 pr-2 not-italic">
                                {apuntando ? <>APUNTAR <span style={{ color: accent }}>DEPORTE</span></> : <>DETALLE <span style={{ color: accent }}>DEPORTE</span></>}
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {apuntando ? (
                            <div className="relative z-10 overflow-y-auto custom-scrollbar pr-1 flex-1">
                                <SportsTab
                                    hoy={dataList}
                                    showToast={showToast}
                                    onSaved={(data) => {
                                        setApuntando(false);
                                        if (onSaved) onSaved(data);
                                    }}
                                />
                            </div>
                        ) : (
                        <>
                        {dataList.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10 shrink-0 z-10 no-scrollbar">
                                {dataList.map((w, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveTabIndex(idx)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border uppercase ${
                                            activeTabIndex === idx
                                                ? 'text-black border-transparent'
                                                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white hover:bg-zinc-800'
                                        }`}
                                        style={activeTabIndex === idx ? { background: accent } : undefined}
                                    >
                                        {w.routineName || w.name || `ACTIVIDAD ${idx + 1}`}
                                    </button>
                                ))}
                            </div>
                        )}

                        {hasActivity ? (
                            <div className="flex flex-col gap-4 relative z-10 overflow-y-auto custom-scrollbar pr-1 flex-1">
                                <div className="bg-zinc-900/50 p-6 rounded-[24px] border border-white/5 text-center relative overflow-hidden shrink-0">
                                    <h3 className="text-3xl font-black text-white uppercase leading-none mb-2 not-italic">{modalName}</h3>

                                    <div className="flex justify-center items-center gap-2 mb-4">
                                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full uppercase font-bold border border-white/5">
                                            INTENSIDAD: {modalIntensity}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-black/40 px-4 py-3 rounded-xl border border-white/5 flex flex-col justify-center">
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1 mb-1"><Clock size={10} /> Tiempo</span>
                                            <span className="text-2xl font-black text-white">{modalDuration}<span className="text-sm text-zinc-600 ml-0.5">m</span></span>
                                        </div>
                                        <div className="bg-black/40 px-4 py-3 rounded-xl border border-white/5 flex flex-col justify-center">
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1 mb-1"><Flame size={10} /> Kcal</span>
                                            <span className="text-2xl font-black" style={{ color: accent }}>{modalKcal}</span>
                                        </div>
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

                        {/* Lo que antes obligaba a irse a Gym > Otros */}
                        <button
                            onClick={() => setApuntando(true)}
                            className="relative z-10 w-full py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs text-black active:scale-95 transition-transform flex items-center justify-center gap-2 shrink-0"
                            style={{ background: accent }}
                        >
                            <Plus size={15} /> Apuntar un deporte
                        </button>
                        </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
