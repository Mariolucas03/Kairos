import { Calendar } from 'lucide-react';

export default function MonthlyRewardsBanner() {
    return (
        <div className="bg-zinc-900/80 border border-purple-500/20 rounded-[24px] p-4 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 bg-purple-600/10 blur-3xl rounded-full -mr-6 -mt-6 pointer-events-none"></div>
            <div className="flex items-center justify-between relative z-10">
                <div className="self-start pt-2">
                    <h3 className="text-white font-black uppercase italic text-sm flex items-center gap-2 mb-1">
                        <Calendar size={14} className="text-purple-400" /> Premios Mensuales
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-medium max-w-[130px] leading-tight">
                        Los 3 que más XP ganen este mes se llevan fichas.
                    </p>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center justify-between w-[100px] bg-black/70 px-3 py-1.5 rounded-lg border border-yellow-500/40 shadow-lg shadow-yellow-500/10 relative z-20">
                        <span className="text-xs text-yellow-400 font-black">1º</span>
                        <span className="text-xs text-white font-bold tracking-wide">10k</span>
                        <img src="/assets/icons/ficha.png" className="w-4 h-4 object-contain" alt="f" />
                    </div>
                    <div className="flex gap-2 relative z-10">
                        <div className="flex items-center justify-between w-[80px] bg-black/50 px-2 py-1 rounded border border-white/10">
                            <span className="text-[10px] text-zinc-300 font-black">2º</span>
                            <span className="text-[10px] text-zinc-200 font-bold tracking-wide">5k</span>
                            <img src="/assets/icons/ficha.png" className="w-3 h-3 object-contain opacity-80" alt="f" />
                        </div>
                        <div className="flex items-center justify-between w-[80px] bg-black/50 px-2 py-1 rounded border border-white/10">
                            <span className="text-[10px] text-orange-600 font-black">3º</span>
                            <span className="text-[10px] text-zinc-200 font-bold tracking-wide">2.5k</span>
                            <img src="/assets/icons/ficha.png" className="w-3 h-3 object-contain opacity-80" alt="f" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
