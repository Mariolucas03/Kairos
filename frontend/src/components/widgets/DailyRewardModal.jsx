import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Lock, Zap, Heart, Loader2 } from 'lucide-react';
import { getRewardForDay } from '../../utils/rewardsGenerator';

// `onClaim` reclama la recompensa; `onClose` solo cierra.
// Antes ambos eran la misma función, así que la X y el fondo también reclamaban
// (y si fallaba, el premio se perdía sin avisar).
export default function DailyRewardModal({ data, onClose, onClaim, claiming = false }) {
    if (!data) return null;

    const {
        currentDay = 1,
        claimedDays = [],
        message = "¡Recompensa Diaria!",
        subMessage = "¡Tu constancia tiene premio!",
        buttonText = "RECLAMAR",
        isViewOnly = false
    } = data;

    // --- EFECTO DE CONFETI ---
    useEffect(() => {
        if (!isViewOnly) {
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 20000 };
            const randomInRange = (min, max) => Math.random() * (max - min) + min;

            const interval = setInterval(function () {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) return clearInterval(interval);
                const particleCount = 50 * (timeLeft / duration);
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#a855f7', '#3b82f6', '#ffffff'] });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#a855f7', '#3b82f6', '#ffffff'] });
            }, 250);

            return () => clearInterval(interval);
        }
    }, [isViewOnly]);

    // --- CÁLCULO DE LA VENTANA DE 5 DÍAS ---
    const getVisibleDays = () => {
        let start = currentDay - 2;
        if (start < 1) start = 1;
        let end = start + 4;
        if (end > 7) { end = 7; start = Math.max(1, end - 4); }
        const days = [];
        for (let i = start; i <= end; i++) days.push(i);
        return days;
    };

    const visibleDays = getVisibleDays();

    // --- RENDERIZADO DE TARJETAS ---
    const renderDayCard = (day) => {
        const reward = getRewardForDay(day);
        const isToday = day === currentDay;
        const isPast = day < currentDay;
        const isClaimed = claimedDays.includes(day);
        const isFuture = day > currentDay;

        let containerStyle = "";
        let textColors = "";

        if (isToday) {
            // El día de hoy destaca por tamaño y borde, no por un degradado con halo
            containerStyle = "bg-[#18181b] border-2 border-purple-500 scale-110 z-20 translate-y-[-8px]";
            textColors = "text-white";
        } else if (isPast) {
            if (isClaimed || (isViewOnly && day <= currentDay)) {
                containerStyle = "bg-green-900/60 border border-green-500/50 scale-95 opacity-90";
                textColors = "text-green-100";
            } else {
                containerStyle = "bg-red-900/40 border border-red-500/30 scale-95 opacity-60 grayscale-[0.5]";
                textColors = "text-red-200";
            }
        } else {
            containerStyle = "bg-gray-800/60 border border-gray-700 scale-90 opacity-50";
            textColors = "text-gray-400";
        }

        return (
            <div key={day} className={`flex flex-col items-center justify-between w-20 h-32 rounded-2xl transition-all duration-300 relative overflow-hidden ${containerStyle}`}>

                <div className={`w-full text-center py-1.5 ${isToday ? 'bg-black/20' : 'bg-black/10'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${textColors}`}>
                        Día {day}
                    </span>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full gap-0.5 pb-2">

                    {/* 1. IMAGEN DEL PREMIO */}
                    {reward.image && (
                        <img
                            src={reward.image}
                            alt="Premio"
                            className={`w-12 h-12 object-contain drop-shadow-md mb-1 ${isToday ? 'animate-bounce' : ''}`}
                            onError={(e) => e.target.style.display = 'none'}
                        />
                    )}

                    {/* 2. CANTIDAD DE FICHAS (SOLO EL NÚMERO, SIN ICONO) */}
                    <div className="flex items-center justify-center">
                        <span className={`text-2xl font-black drop-shadow-sm leading-none tracking-tighter ${isToday ? 'text-white' : textColors}`}>
                            {reward.gameCoins}
                        </span>
                    </div>

                    {/* 3. XP (SOLO SI ES > 0) */}
                    {reward.xp > 0 && (
                        <div className={`flex items-center gap-0.5 text-[10px] font-bold ${isToday ? 'text-blue-200' : 'opacity-70'}`}>
                            <span>+{reward.xp} XP</span>
                            <Zap size={8} fill="currentColor" />
                        </div>
                    )}

                    {/* 4. VIDA (SOLO EN DÍAS QUE LA OTORGAN) */}
                    {reward.hp > 0 && (
                        <div className={`flex items-center gap-0.5 text-[10px] font-bold ${isToday ? 'text-red-200' : 'opacity-70'}`}>
                            <span>+{reward.hp} HP</span>
                            <Heart size={8} fill="currentColor" />
                        </div>
                    )}
                </div>

                {isFuture && <div className="absolute top-1 right-1 text-gray-500"><Lock size={12} /></div>}
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
            <div className="relative z-10 w-full max-w-lg flex flex-col items-center animate-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                    <h2 className="text-3xl md:text-4xl font-black text-purple-300 uppercase tracking-[-0.045em] not-italic">{message}</h2>
                    <p className="text-purple-300/80 font-bold text-sm tracking-widest mt-2 uppercase">{subMessage}</p>
                </div>
                <div className="flex items-center justify-center gap-2 md:gap-3 mb-10 w-full px-2 py-8">
                    {visibleDays.map(day => renderDayCard(day))}
                </div>
                <button
                    onClick={isViewOnly ? onClose : onClaim}
                    disabled={claiming}
                    className={`w-full max-w-xs py-4 rounded-2xl font-black text-xl uppercase tracking-widest transition-all transform active:scale-95 hover:scale-105 border-b-4 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-wait ${isViewOnly ? 'bg-gray-800 text-gray-400 border-gray-900 hover:bg-gray-700 hover:text-white' : 'bg-purple-600 text-white border-purple-800 hover:brightness-110'}`}
                >
                    {claiming && <Loader2 size={20} className="animate-spin" />}
                    {claiming ? 'RECLAMANDO...' : buttonText}
                </button>
                <button onClick={onClose} className="absolute -top-12 right-0 md:-right-10 bg-white/10 p-2 rounded-full hover:bg-white/20 text-white transition-colors"><X size={24} /></button>
            </div>
        </div>,
        document.body
    );
}