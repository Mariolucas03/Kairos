import { useState, useRef, useEffect } from 'react';
import { Save, Lock, Skull, Activity } from 'lucide-react';
import api from '../../services/api';

export default function HealthWidget({ user, setUser }) {
    const [isOpen, setIsOpen] = useState(false);
    const [missionInput, setMissionInput] = useState('');
    const [loading, setLoading] = useState(false);
    const containerRef = useRef(null);

    // --- IMAGEN PERSONALIZADA ---
    const ICON_HEART = "/assets/icons/corazon.png";

    // --- DATOS ---
    const hp = user?.hp ?? 100;
    const maxHp = user?.maxHp ?? 100;
    const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));

    // --- LÓGICA DE COLOR DINÁMICA ---
    const getStatusColor = (value) => {
        if (value >= 80) return { hex: '#22c55e', text: 'text-green-500' };   // Verde (Alto)
        if (value >= 60) return { hex: '#a3e635', text: 'text-lime-400' };    // Lima (Bien)
        if (value >= 40) return { hex: '#facc15', text: 'text-yellow-400' };  // Amarillo (Medio)
        if (value >= 20) return { hex: '#fb923c', text: 'text-orange-400' };  // Naranja (Bajo)
        return { hex: '#ef4444', text: 'text-red-500' };                      // Rojo (Crítico)
    };

    const statusStyle = getStatusColor(hp);
    const ringColor = statusStyle.hex;
    const isCritical = hp < 20;

    const trackColor = '#27272a';
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * hpPercent) / 100;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSaveMission = async () => {
        if (!missionInput.trim()) return;
        setLoading(true);
        try {
            const res = await api.post('/users/set-redemption-mission', { mission: missionInput });
            const updatedUser = { ...user, redemptionMission: missionInput };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setIsOpen(false);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const handleDamageTest = async () => {
        try {
            const damage = hp <= 10 ? 1 : 10;
            const newHp = Math.max(0, (user.hp || 0) - damage);
            const res = await api.put('/users/update-stats', { hp: newHp });
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
            if (newHp === 0) window.location.reload();
        } catch (error) { console.error(error); }
    };

    const confirmedMission = user?.redemptionMission || null;
    const hasMissionSet = confirmedMission && confirmedMission.trim().length > 0;
    const showTutorial = !hasMissionSet && !isOpen;

    return (
        <div className="relative z-50 select-none" ref={containerRef}>

            {showTutorial && (
                <div className="absolute top-14 right-[-20px] w-32 z-50 pointer-events-none animate-bounce">
                    <div className="bg-red-900/90 text-[#E8DCC4] text-[9px] font-bold p-2 rounded-lg border border-red-500/30 text-center relative shadow-xl backdrop-blur-sm">
                        <div className="absolute -top-1.5 right-1/2 translate-x-1/2 w-3 h-3 bg-red-900/90 rotate-45 border-t border-l border-red-500/30"></div>
                        <p>¡FIRMA TU PACTO!</p>
                    </div>
                </div>
            )}

            {/* --- BOTÓN DE SALUD --- */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative w-16 h-16 flex items-center justify-center group active:scale-95 transition-transform z-10"
            >
                {/* 2. Anillo SVG */}
                <svg viewBox="0 0 70 70" className="absolute inset-0 w-full h-full rotate-[-90deg]">
                    <circle cx="35" cy="35" r={radius} fill="none" stroke={trackColor} strokeWidth="4" />
                    <circle
                        cx="35" cy="35" r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-700 ease-out"
                        style={{ filter: isCritical ? 'drop-shadow(0 0 4px #ef4444)' : 'none' }}
                    />
                </svg>

                {/* 3. Contenido Central */}
                <div className="relative z-10 flex flex-col items-center justify-center pt-2">
                    <span
                        // AÑADIDO: translate-y-[2px] para bajar el número
                        className={`text-lg font-black leading-none tracking-tighter transition-colors duration-300 translate-y-[5px] ${statusStyle.text}`}
                        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                    >
                        {hp}
                    </span>

                    <img
                        src={ICON_HEART}
                        alt="HP"
                        // AÑADIDO: -translate-y-[2px] para subir el corazón
                        className={`w-7 h-7 object-contain mt-0.5 -translate-y-[2px] ${isCritical ? 'opacity-100 brightness-125 animate-pulse' : 'opacity-90'}`}
                    />
                </div>
            </button>

            {/* --- MENÚ DESPLEGABLE --- */}
            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl p-5 animate-in fade-in slide-in-from-top-2 overflow-hidden z-50">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-800">
                        <div className={`p-2 rounded-full ${isCritical ? 'bg-red-900/20' : 'bg-zinc-800'}`}>
                            <Activity size={20} className={statusStyle.text} />
                        </div>
                        <div>
                            <h3 className="font-black uppercase text-xs tracking-widest text-zinc-300">Signos Vitales</h3>
                            <p className={`text-[10px] font-bold ${statusStyle.text}`}>
                                {hp === 100 ? 'PLENITUD' : isCritical ? 'CRÍTICO' : 'ESTABLE'}
                            </p>
                        </div>
                    </div>

                    {!hasMissionSet ? (
                        <div className="bg-[#12100E] p-3 rounded-xl border border-red-900/30 mb-4">
                            <label className="block text-[9px] text-[#C4A484] uppercase font-bold mb-2">Pacto de Rescate:</label>
                            <textarea
                                rows={2}
                                placeholder="Ej: 50 Burpees si muero..."
                                value={missionInput}
                                onChange={(e) => setMissionInput(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 outline-none mb-2"
                            />
                            <button onClick={handleSaveMission} disabled={loading} className="w-full bg-zinc-800 text-zinc-200 py-2 rounded-lg text-xs font-bold flex justify-center gap-2 hover:bg-zinc-700">
                                <Save size={12} /> SELLAR
                            </button>
                        </div>
                    ) : (
                        <div className="bg-[#12100E] p-3 rounded-xl border border-zinc-800 mb-4 flex gap-3">
                            <Lock size={16} className="text-zinc-500" />
                            <div>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase">Pacto Activo:</p>
                                <p className="text-zinc-300 text-xs italic">"{user.redemptionMission}"</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleDamageTest}
                        className="w-full bg-black hover:bg-red-900/20 text-zinc-500 hover:text-red-400 py-2 rounded-lg text-[10px] font-bold border border-dashed border-zinc-800"
                    >
                        <Skull size={12} className="inline mr-2" /> TEST DAÑO (-10)
                    </button>
                </div>
            )}
        </div>
    );
}