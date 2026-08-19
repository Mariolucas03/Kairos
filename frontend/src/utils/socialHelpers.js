import { Dumbbell, Target, Flame, Zap } from 'lucide-react';

// Helpers y constantes compartidos por la sección social
// (feed, amigos, clanes, ranking y perfiles de usuario).

export const getLevelStyle = (level) => {
    if (level >= 100) return "bg-gradient-to-r from-red-500 via-purple-500 via-blue-500 via-green-500 to-red-500 text-white border-white/50 shadow-[0_0_10px_rgba(255,255,255,0.5)] animate-smooth-gradient";
    if (level >= 90) return "bg-cyan-900/40 text-cyan-400 border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.2)]";
    if (level >= 80) return "bg-pink-900/40 text-pink-400 border-pink-500/40";
    if (level >= 70) return "bg-purple-900/40 text-purple-400 border-purple-500/40";
    if (level >= 60) return "bg-red-900/40 text-red-400 border-red-500/40";
    if (level >= 50) return "bg-orange-900/40 text-orange-400 border-orange-500/40";
    if (level >= 40) return "bg-yellow-900/40 text-yellow-400 border-yellow-500/40";
    if (level >= 30) return "bg-emerald-900/40 text-emerald-400 border-emerald-500/40";
    if (level >= 20) return "bg-blue-900/40 text-blue-400 border-blue-500/40";
    if (level >= 10) return "bg-indigo-900/40 text-indigo-400 border-indigo-500/40";
    return "bg-zinc-800 text-zinc-400 border-zinc-700";
};

export const cardBaseStyle = "flex items-center justify-between bg-zinc-950 p-3 rounded-[20px] border border-white/5 mb-2 relative group hover:border-white/10 transition-all shadow-sm";

// `hex` es el mismo tono que las clases de Tailwind de al lado, en un formato
// que se puede usar en `style` (acentos, halos, bordes calculados).
export const RANK_CONFIG = {
    dios: { label: 'DIOS', color: 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10', hex: '#eab308', value: 4 },
    rey: { label: 'REY', color: 'text-purple-400 border-purple-500/50 bg-purple-500/10', hex: '#a855f7', value: 3 },
    guerrero: { label: 'GUERRERO', color: 'text-red-400 border-red-500/50 bg-red-500/10', hex: '#f87171', value: 2 },
    recluta: { label: 'RECLUTA', color: 'text-blue-400 border-blue-500/50 bg-blue-500/10', hex: '#60a5fa', value: 1 },
    esclavo: { label: 'ESCLAVO', color: 'text-zinc-500 border-zinc-700 bg-zinc-800/50', hex: '#71717a', value: 0 }
};

// `bg` es un color PLANO, no paradas de degradado. Antes era "from-x to-y",
// que sólo pinta acompañado de `bg-gradient-to-r`: usado suelto no pinta NADA
// y la barra de progreso se quedaba invisible. Un tono por evento.
export const EVENT_CONFIG = {
    volume: { title: "Titanes del Hierro", unit: "KG", icon: Dumbbell, color: "text-blue-400", bg: "bg-blue-500", border: "border-blue-500/30" },
    missions: { title: "Cruzada Disciplina", unit: "MISIONES", icon: Target, color: "text-green-400", bg: "bg-green-500", border: "border-green-500/30" },
    calories: { title: "Horno Humano", unit: "KCAL", icon: Flame, color: "text-orange-400", bg: "bg-orange-500", border: "border-orange-500/30" },
    xp: { title: "Era de Sabiduría", unit: "XP", icon: Zap, color: "text-purple-400", bg: "bg-purple-500", border: "border-purple-500/30" }
};

export const customAnimationsStyle = `
  @keyframes smoothGradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animate-smooth-gradient {
    background-size: 400% 400%;
    animation: smoothGradient 5s ease infinite;
  }
`;

// Fetcher común para SWR en toda la sección social
export const socialFetcher = (api) => (url) => api.get(url).then(res => res.data);
