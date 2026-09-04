import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, Zap, Heart, Loader2 } from 'lucide-react';
import { getRewardForDay } from '../../utils/rewardsGenerator';

// `onClaim` reclama la recompensa; `onClose` solo cierra.
// Antes ambos eran la misma función, así que la X y el fondo también reclamaban
// (y si fallaba, el premio se perdía sin avisar).
export default function DailyRewardModal({ data, onClose, onClaim, claiming = false }) {
    // ⚠️ El "if (!data) return null" estaba AQUI, antes del useEffect de abajo.
    //
    // Eso rompe la regla de oro de los hooks: React exige que en cada render se
    // llamen los MISMOS hooks y en el mismo orden. Si la ventana se pinta una vez
    // con datos (ejecutando el efecto) y despues vuelve a pintarse con data en
    // null, React cuenta menos hooks de los que esperaba y revienta con
    // "Rendered fewer hooks than expected": pantalla roja, no un fallo silencioso.
    //
    // La salida anticipada baja despues de los hooks, y mientras tanto se
    // desestructura sobre un objeto vacio para no petar por leer de null.
    const {
        currentDay = 1,
        claimedDays = [],
        message = "¡Recompensa Diaria!",
        subMessage = "¡Tu constancia tiene premio!",
        buttonText = "RECLAMAR",
        isViewOnly = false
    } = data || {};

    // --- EFECTO DE CONFETI ---
    //
    // La libreria se carga AQUI dentro y no arriba con el resto de imports. El
    // confeti solo se ve al reclamar la recompensa, pero al importarlo arriba
    // viajaba dentro del paquete inicial: todo el mundo se lo descargaba al
    // abrir la app, incluido quien nunca abre esta ventana.
    useEffect(() => {
        if (!isViewOnly) {
            let interval;
            let cancelado = false;
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 20000 };
            const randomInRange = (min, max) => Math.random() * (max - min) + min;

            import('canvas-confetti').then(({ default: confetti }) => {
                // Si la ventana se cerro mientras se descargaba, no se lanza nada
                if (cancelado) return;

                interval = setInterval(function () {
                    const timeLeft = animationEnd - Date.now();
                    if (timeLeft <= 0) return clearInterval(interval);
                    const particleCount = 50 * (timeLeft / duration);
                    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#a855f7', '#3b82f6', '#ffffff'] });
                    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#a855f7', '#3b82f6', '#ffffff'] });
                }, 250);
            }).catch(() => { /* sin confeti no pasa nada: la recompensa se reclama igual */ });

            return () => { cancelado = true; clearInterval(interval); };
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
            // ⚠️ Antes, abriendo desde el calendario (isViewOnly) TODO dia pasado
            // se pintaba verde aunque no lo hubieras cobrado, asi que los dias
            // perdidos eran invisibles justo donde se van a mirar. Manda
            // `claimedDays` y solo eso.
            if (isClaimed) {
                containerStyle = "bg-green-900/60 border border-green-500/50 scale-95 opacity-90";
                textColors = "text-green-100";
            } else {
                // ⚠️ Un dia perdido tiene que DOLER un poco.
                //
                // Estaba en rojo, si, pero con opacity-60 y medio en gris: se
                // confundia con los dias futuros bloqueados y no se leia como
                // "esto lo has perdido". Ahora el rojo es rojo, lleva una equis
                // y lo dice con todas las letras.
                containerStyle = "bg-red-950/70 border-2 border-red-500/60 scale-95";
                textColors = "text-red-300";
            }
        } else {
            containerStyle = "bg-gray-800/60 border border-gray-700 scale-90 opacity-50";
            textColors = "text-gray-400";
        }

        return (
            // ⚠️ ALTO SUFICIENTE PARA LO QUE LLEVA DENTRO.
            //
            // Era w-20 h-32 con overflow-hidden, y el contenido suma mas: la
            // cabecera del dia, el icono de 48, el numero grande, la linea de XP
            // y a veces la de vida. Se pasaba de 128 px, asi que el "+25 XP" se
            // cortaba por abajo en TODAS las tarjetas: veias media linea y no
            // sabias que te iban a dar.
            //
            // Y mas estrechas, que cinco de 80 px no caben en un movil de 375.
            <div key={day} className={`flex flex-col items-center justify-between w-[66px] h-[148px] rounded-2xl transition-all duration-300 relative overflow-hidden ${containerStyle}`}>

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
                            className={`w-9 h-9 object-contain drop-shadow-md ${isToday ? 'animate-bounce' : ''}`}
                            onError={(e) => e.target.style.display = 'none'}
                        />
                    )}

                    {/* 2. CANTIDAD DE FICHAS (SOLO EL NÚMERO, SIN ICONO) */}
                    <div className="flex items-center justify-center">
                        <span className={`text-xl font-black drop-shadow-sm leading-none tracking-tighter ${isToday ? 'text-white' : textColors}`}>
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

                {/* El dia que dejaste pasar */}
                {isPast && !isClaimed && (
                    <>
                        <div className="absolute top-1 right-1 text-red-400"><X size={12} strokeWidth={3} /></div>
                        <div className="absolute inset-x-0 bottom-0 bg-red-500/25 py-0.5">
                            <span className="block text-[7px] font-black uppercase tracking-[0.15em] text-red-300 text-center not-italic">Perdido</span>
                        </div>
                    </>
                )}
            </div>
        );
    };

    // Sin datos no hay ventana. Va AQUI y no arriba: los hooks ya se han
    // llamado todos, asi que React cuenta siempre los mismos.
    if (!data) return null;

    return createPortal(
        // ⚠️ POR ENCIMA DE LOS DEMAS MODALES, no al mismo nivel.
        //
        // Los veintiun modales de la app viven todos en z-[9999]. Este no es uno
        // mas: es una puerta que se abre sola al entrar al home. Con el mismo
        // z-index, abrir un widget mientras estaba puesto dejaba los dos
        // pintandose entrelazados —el boton "RECLAMAR AHORA" asomando por encima
        // de la tarjeta de misiones, con el calendario de premios borroso detras—
        // y parecia que la app se habia roto.
        <div style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }} className="fixed left-0 right-0 z-[10050] flex items-center justify-center p-4 overflow-y-auto">
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