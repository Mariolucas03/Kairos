// Helpers compartidos entre Social.jsx y los componentes del feed social
// (WorkoutPostCard, FriendProfileModal) para evitar import circular con la página.

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
