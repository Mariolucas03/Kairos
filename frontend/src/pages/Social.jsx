import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
    Users, Shield, Search, UserPlus, Swords, Crown, Loader2, Mail, Check, X, Bell, Zap, Trash2, LogOut,
    ChevronDown, ChevronUp, AlertTriangle, Dumbbell, Gift, Lock, Trophy, Medal, Flame, Target,
    Coins, Wrench, Footprints, Timer, MapPin, Construction, Eye, DoorOpen, Edit, Globe, Calendar
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';

// CONFIGURACIÓN DE RANGOS
const RANK_CONFIG = {
    dios: { label: 'DIOS', color: 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10', value: 4 },
    rey: { label: 'REY', color: 'text-purple-400 border-purple-500/50 bg-purple-500/10', value: 3 },
    guerrero: { label: 'GUERRERO', color: 'text-red-400 border-red-500/50 bg-red-500/10', value: 2 },
    recluta: { label: 'RECLUTA', color: 'text-blue-400 border-blue-500/50 bg-blue-500/10', value: 1 },
    esclavo: { label: 'ESCLAVO', color: 'text-zinc-500 border-zinc-700 bg-zinc-800/50', value: 0 }
};

const EVENT_CONFIG = {
    volume: { title: "Titanes del Hierro", unit: "KG", icon: Dumbbell, color: "text-blue-400", bg: "from-blue-600 to-cyan-500", border: "border-blue-500/30" },
    missions: { title: "Cruzada Disciplina", unit: "MISIONES", icon: Target, color: "text-green-400", bg: "from-green-600 to-emerald-500", border: "border-green-500/30" },
    calories: { title: "Horno Humano", unit: "KCAL", icon: Flame, color: "text-orange-400", bg: "from-orange-600 to-red-500", border: "border-orange-500/30" },
    xp: { title: "Era de Sabiduría", unit: "XP", icon: Zap, color: "text-purple-400", bg: "from-purple-600 to-indigo-500", border: "border-purple-500/30" }
};

// --- DEFINICIÓN DE ANIMACIÓN CSS SUAVE (Igual que en Header) ---
const customAnimationsStyle = `
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

// --- HELPER: COLORES DE NIVEL ---
const getLevelStyle = (level) => {
    // Nivel 100+ (Cromático Suave - Sin parpadeo)
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

// ESTILO BASE DE TARJETAS
const cardBaseStyle = "flex items-center justify-between bg-zinc-950 p-4 rounded-[24px] border border-white/5 mb-2 relative group hover:border-white/10 transition-all shadow-sm";

// ==========================================
// 1. COMPONENTES UI
// ==========================================

// BANNER PREMIOS MENSUALES (CORREGIDO: LAYOUT PIRÁMIDE)
const MonthlyRewardsBanner = () => (
    <div className="bg-zinc-900/80 border border-purple-500/20 rounded-[24px] p-4 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 bg-purple-600/10 blur-3xl rounded-full -mr-6 -mt-6 pointer-events-none"></div>

        <div className="flex items-center justify-between relative z-10">
            {/* Texto Izquierda */}
            <div className="self-start pt-2">
                <h3 className="text-white font-black uppercase italic text-sm flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-purple-400" /> Premios Mensuales
                </h3>
                <p className="text-[10px] text-zinc-500 font-medium max-w-[120px] leading-tight">
                    Los 3 mejores al final del mes ganan fichas.
                </p>
            </div>

            {/* Estructura Pirámide Derecha */}
            <div className="flex flex-col items-center gap-1.5">

                {/* 1º Puesto (Arriba Centrado) */}
                <div className="flex items-center justify-between w-[100px] bg-black/70 px-3 py-1.5 rounded-lg border border-yellow-500/40 shadow-lg shadow-yellow-500/10 relative z-20">
                    <span className="text-xs text-yellow-400 font-black">1º</span>
                    <span className="text-xs text-white font-bold tracking-wide">10k</span>
                    <img src="/assets/icons/ficha.png" className="w-4 h-4 object-contain" alt="f" />
                </div>

                {/* Fila 2º y 3º (Abajo) */}
                <div className="flex gap-2 relative z-10">
                    {/* 2º */}
                    <div className="flex items-center justify-between w-[80px] bg-black/50 px-2 py-1 rounded border border-white/10">
                        <span className="text-[10px] text-zinc-300 font-black">2º</span>
                        <span className="text-[10px] text-zinc-200 font-bold tracking-wide">5k</span>
                        <img src="/assets/icons/ficha.png" className="w-3 h-3 object-contain opacity-80" alt="f" />
                    </div>
                    {/* 3º */}
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

const RankingItem = ({ player, index, isMe }) => {
    let rankIcon = <span className="font-bold text-sm text-zinc-500">#{index + 1}</span>;
    let rankStyles = "border-white/5 bg-zinc-950";
    let textStyle = "text-white";

    if (index === 0) {
        rankIcon = <Crown size={24} className="text-yellow-400 fill-yellow-400 animate-pulse" />;
        rankStyles = "border-yellow-500/50 bg-gradient-to-r from-yellow-900/20 to-black shadow-[0_0_15px_rgba(234,179,8,0.2)]";
        textStyle = "text-yellow-400";
    } else if (index === 1) {
        rankIcon = <Medal size={24} className="text-zinc-300 fill-zinc-300" />;
        rankStyles = "border-zinc-400/30 bg-gradient-to-r from-zinc-800/40 to-black";
        textStyle = "text-zinc-200";
    } else if (index === 2) {
        rankIcon = <Medal size={24} className="text-orange-600 fill-orange-600" />;
        rankStyles = "border-orange-600/30 bg-gradient-to-r from-orange-900/20 to-black";
        textStyle = "text-orange-200";
    }

    const levelClass = getLevelStyle(player.level || 1);

    return (
        <div className={`flex items-center justify-between p-4 rounded-[24px] border mb-2 relative overflow-hidden group ${rankStyles} ${isMe ? 'ring-1 ring-white/20' : ''}`}>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors"></div>
            <div className="flex items-center gap-4 flex-1 min-w-0 relative z-10">
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">{rankIcon}</div>
                <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-xs font-black text-zinc-600 border border-white/10 overflow-hidden">
                        {player.avatar ? <img src={player.avatar} className="w-full h-full object-cover" alt="avatar" /> : player.username?.charAt(0)}
                    </div>
                    {player.frame && <img src={player.frame} className="absolute -top-1.5 -left-1.5 w-[60px] h-[60px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                </div>
                <div className="flex flex-col min-w-0 pr-2">
                    <span className={`text-base font-black truncate uppercase tracking-tight ${textStyle}`}>
                        {player.username}
                        {isMe && <span className="text-[8px] bg-white/20 text-white px-1.5 py-0.5 rounded ml-2 align-middle font-bold">YO</span>}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase truncate tracking-wider">{player.title || 'Novato'}</span>
                </div>
            </div>

            <div className="flex flex-col items-end relative z-10 pl-2">
                <div className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide mb-1 ${levelClass}`}>
                    LVL {player.level || 1}
                </div>
                <span className="text-[9px] text-zinc-600 font-mono tracking-tight">{(player.xp || player.currentXP || 0).toLocaleString()} XP</span>
            </div>
        </div>
    );
};

function FriendCard({ friend, onRemoveRequest, onChallengeOrView }) {
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const THRESHOLD = 80;

    const handleStart = (cx) => { setIsDragging(true); startX.current = cx; };
    const handleMove = (cx) => { if (!isDragging) return; const diff = cx - startX.current; setDragX(diff > 150 ? 150 : diff < -150 ? -150 : diff); };
    const handleEnd = () => { setIsDragging(false); if (dragX < -THRESHOLD) onRemoveRequest(friend); else if (dragX > THRESHOLD) onChallengeOrView(friend); setDragX(0); };

    let bgAction = dragX > 0 ? 'bg-zinc-800 text-yellow-500' : 'bg-red-900/20 text-red-500';

    const missions = friend.missionProgress || { completed: 0, total: 1 };
    const safeTotal = Math.max(missions.total || 1, missions.completed, 1);
    const percent = Math.min((missions.completed / safeTotal) * 100, 100);

    const levelClass = getLevelStyle(friend.level || 1);

    return (
        <div className="relative w-full h-[82px] mb-2 select-none isolate overflow-hidden rounded-[24px]">
            <div className={`absolute inset-0 flex items-center ${bgAction} -z-10 font-bold px-6 justify-between transition-colors`}>
                <span className={`flex items-center gap-2 text-xs font-black ${dragX > 0 ? 'opacity-100' : 'opacity-0'}`}><Construction size={18} /> DUELO</span>
                <span className={`flex items-center gap-2 text-xs font-black ${dragX < 0 ? 'opacity-100' : 'opacity-0'}`}>ELIMINAR <Trash2 size={18} /></span>
            </div>
            <div style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease' }}
                onTouchStart={e => handleStart(e.targetTouches[0].clientX)}
                onTouchMove={e => handleMove(e.targetTouches[0].clientX)}
                onTouchEnd={handleEnd}
                className={`${cardBaseStyle} h-full`}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-xs font-black text-zinc-600 border border-white/10 overflow-hidden">
                            {friend.avatar ? <img src={friend.avatar} className="w-full h-full object-cover" alt="av" /> : friend.username.charAt(0)}
                        </div>
                        {friend.frame && <img src={friend.frame} className="absolute -top-1.5 -left-1.5 w-[60px] h-[60px] max-w-none pointer-events-none z-20" />}
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-[3px] border-zinc-950 rounded-full z-30 ${friend.online ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-zinc-700'}`}></div>
                    </div>
                    <div className="flex flex-col min-w-0 pr-2 items-start">
                        <span className="text-base font-black text-white truncate uppercase tracking-tight leading-none mb-1.5">{friend.username}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${levelClass}`}>
                            LVL {friend.level}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 pl-4 border-l border-white/5 h-full justify-center">
                    <div className="flex items-center gap-1.5">
                        <Target size={14} className="text-blue-500" />
                        <span className="text-xs font-black text-zinc-300 tracking-wider">
                            {missions.completed} <span className="text-zinc-600">/</span> {safeTotal}
                        </span>
                    </div>
                    <div className="w-16 h-1.5 bg-black rounded-full overflow-hidden border border-white/10">
                        <div className="h-full bg-blue-600 rounded-full shadow-[0_0_8px_#2563eb]" style={{ width: `${percent}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ClanMemberCard({ member, myRank, onUpdateRank, onKick, currentUserId }) {
    if (!member) return null;
    const currentRankData = RANK_CONFIG[member.clanRank || 'esclavo'];
    const hasAuthority = member._id !== currentUserId && ((RANK_CONFIG[myRank || 'esclavo'].value === 4) || (RANK_CONFIG[myRank || 'esclavo'].value === 3 && RANK_CONFIG[member.clanRank || 'esclavo'].value < 3));
    const availableOptions = ['esclavo', 'recluta', 'guerrero'];
    if (RANK_CONFIG[myRank || 'esclavo'].value === 4) availableOptions.push('rey');
    const nameColor = member.clanRank === 'dios' ? 'text-yellow-400' : 'text-white';

    const levelClass = getLevelStyle(member.level || 1);

    return (
        <div className={cardBaseStyle}>
            <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                <div className="relative flex-shrink-0 overflow-visible">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-xs font-black text-zinc-600 border border-white/5 overflow-hidden">
                        {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" alt="av" /> : member.username?.charAt(0)}
                    </div>
                    {member.frame && <img src={member.frame} className="absolute -top-1.5 -left-1.5 w-[52px] h-[52px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                </div>
                <div className="flex flex-col min-w-0 pr-2 items-start">
                    <span className={`text-sm font-black truncate ${nameColor}`}>{member.username}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${levelClass}`}>
                            Lvl {member.level}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase truncate max-w-[80px]">{member.title || 'Novato'}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {hasAuthority ? (
                    <div className={`relative flex items-center gap-1 px-2 py-1 rounded-lg border cursor-pointer hover:brightness-110 transition-all ${currentRankData.color}`}>
                        {member.clanRank === 'dios' && <Crown size={10} strokeWidth={3} />}
                        <span className="text-[9px] font-black uppercase tracking-wider">{currentRankData.label}</span>
                        <ChevronDown size={10} className="opacity-70" />
                        <select className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-50" value={member.clanRank || 'esclavo'} onChange={(e) => onUpdateRank(member._id, e.target.value)}>
                            {availableOptions.map(opt => (
                                <option key={opt} value={opt} className="bg-white text-black font-bold">
                                    {opt.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className={`px-2 py-1 rounded-lg border opacity-90 flex items-center gap-1 ${currentRankData.color}`}>
                        {member.clanRank === 'dios' && <Crown size={10} strokeWidth={3} />}
                        <span className="text-[9px] font-black uppercase tracking-wider">{currentRankData.label}</span>
                    </div>
                )}
                {hasAuthority && (
                    <button onClick={() => onKick(member)} className="w-7 h-7 flex items-center justify-center bg-red-900/20 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}

// MODAL DUELO
function DuelStatusModal({ duel, userId, onClose }) {
    if (!duel) return null;
    const iAmChallenger = duel.challenger._id === userId;
    const myScore = duel.scores[userId] || 0;
    const opponentId = iAmChallenger ? duel.opponent._id : duel.challenger._id;
    const opponentScore = duel.scores[opponentId] || 0;
    const opponentName = iAmChallenger ? duel.opponent.username : duel.challenger.username;
    const winning = myScore > opponentScore;
    const losing = myScore < opponentScore;
    const getUnit = (t) => { if (t === 'gym') return 'Kg'; if (t === 'distance') return 'Km'; if (t === 'steps') return ''; return 'Misiones'; };
    const duelType = duel.type ? duel.type.toUpperCase() : 'DESCONOCIDO';

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95">
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-black/50 p-2 rounded-full"><X size={20} /></button>
                <div className="text-center mb-8 mt-2">
                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter flex items-center justify-center gap-2"><Swords className="text-red-500" /> EN DUELO</h2>
                    <div className="flex justify-center items-center gap-2 mt-2">
                        <span className="text-[10px] bg-red-900/20 text-red-400 px-2 py-1 rounded border border-red-500/20 uppercase font-bold">{duelType}</span>
                        <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1"><Timer size={10} /> 24H</span>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <div className={`flex-1 bg-black border-2 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden transition-all ${winning ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'border-zinc-800'}`}>
                        <span className="text-[10px] font-black text-zinc-500 uppercase mb-2">TÚ</span>
                        <span className={`text-2xl font-black ${winning ? 'text-green-400' : 'text-white'}`}>{myScore.toLocaleString()} <span className="text-[10px] text-zinc-500">{getUnit(duel.type)}</span></span>
                    </div>
                    <div className="text-xl font-black text-red-600 italic">VS</div>
                    <div className={`flex-1 bg-black border-2 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden transition-all ${losing ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : 'border-zinc-800'}`}>
                        <span className="text-[10px] font-black text-zinc-500 uppercase mb-2 truncate max-w-[80px]">{opponentName}</span>
                        <span className={`text-2xl font-black ${losing ? 'text-yellow-400' : 'text-white'}`}>{opponentScore.toLocaleString()} <span className="text-[10px] text-zinc-500">{getUnit(duel.type)}</span></span>
                    </div>
                </div>
                <div className="mt-6 text-center bg-black/50 border border-yellow-500/10 p-4 rounded-2xl">
                    <p className="text-[10px] text-yellow-600 uppercase font-bold tracking-widest mb-1">Bote Acumulado</p>
                    <div className="flex items-center justify-center gap-2 text-3xl font-black text-yellow-500"><Coins size={24} className="fill-yellow-500/20" /> {duel.betAmount * 2}</div>
                </div>
            </div>
        </div>
    );
}

// MODAL CREAR DESAFÍO
function CreateChallengeModal({ friend, onClose, onSend }) {
    const [bet, setBet] = useState(0);
    const [type, setType] = useState('missions');
    const TYPES = [{ id: 'missions', label: 'Misiones', icon: <Target size={20} /> }, { id: 'steps', label: 'Pasos', icon: <Footprints size={20} /> }, { id: 'gym', label: 'Gym', icon: <Dumbbell size={20} /> }, { id: 'distance', label: 'Distancia', icon: <MapPin size={20} /> }];
    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-black/50 p-2 rounded-full"><X size={20} /></button>
                <div className="flex justify-center mb-4"><div className="bg-red-600/20 p-4 rounded-full shadow-[0_0_30px_rgba(220,38,38,0.3)] animate-pulse border border-red-500/50"><Swords size={32} className="text-red-500" /></div></div>
                <h2 className="text-2xl font-black text-white uppercase italic text-center mb-1">DESAFIAR A</h2>
                <h3 className="text-xl font-bold text-red-500 text-center mb-6 truncate">{friend.username}</h3>
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2 ml-1">Modalidad</label>
                        <div className="grid grid-cols-2 gap-2">
                            {TYPES.map(t => (
                                <button key={t.id} onClick={() => setType(t.id)} className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all ${type === t.id ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-black border-zinc-800 text-zinc-500 hover:bg-zinc-900'}`}>
                                    {t.icon}<span className="text-[9px] font-bold uppercase">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2 ml-1">Tu Apuesta (Fichas)</label>
                        <div className="relative">
                            <input type="number" value={bet} onChange={(e) => setBet(Math.max(0, parseInt(e.target.value) || 0))} className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-center text-2xl font-black text-yellow-500 focus:border-yellow-500 outline-none" />
                            <Coins className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-600" size={20} />
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-2 font-bold text-center uppercase tracking-wide">Bote Total: <span className="text-yellow-500">{bet * 2}</span> Fichas</p>
                    </div>
                </div>
                <button onClick={() => onSend(friend._id, type, bet)} className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-transform border-b-4 border-red-900">LANZAR RETO</button>
            </div>
        </div>
    );
}

// 3. MODAL CLAN PREVIEW (FLOTANTE + FIX SPACING)
function ClanPreviewModal({ clanId, currentUserId, userClanId, onClose, onJoin }) {
    const [clanData, setClanData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await api.get(`/clans/${clanId}`);
                setClanData(res.data);
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchDetails();
    }, [clanId]);

    if (!clanId) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
            <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl relative z-10 animate-in zoom-in-95 mt-10 sm:mt-0">
                <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-black/50 p-2 rounded-full text-zinc-400 hover:text-white border border-white/10"><X size={20} /></button>
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="animate-spin text-yellow-500" size={32} />
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Espiando clan...</p>
                    </div>
                ) : clanData ? (
                    <>
                        <div className="relative bg-zinc-900 p-6 pb-8 border-b border-white/10 shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none"></div>
                            <div className="flex flex-col items-center relative z-10">
                                <div className="text-5xl mb-3 filter drop-shadow-lg">{clanData.icon}</div>
                                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter text-center leading-none mb-2">{clanData.name}</h2>
                                <p className="text-xs text-zinc-400 font-medium text-center max-w-[80%] italic">"{clanData.description}"</p>

                                <div className="flex items-center gap-4 mt-4">
                                    <span className="text-[10px] font-bold bg-zinc-950 border border-zinc-800 text-zinc-400 px-3 py-1 rounded-full flex items-center gap-1">
                                        <Users size={10} /> {clanData.members.length} Miembros
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                                            <Zap size={14} fill="currentColor" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-purple-300 leading-none">{clanData.totalPower}</span>
                                            <span className="text-[8px] font-bold text-zinc-500 uppercase">Poder</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 bg-black/40">
                            {clanData.eventStats && (
                                <WeeklyEventWidget clan={clanData} onClaim={() => { }} isPreview={true} />
                            )}

                            <div>
                                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 pl-2 flex justify-between items-center">
                                    <span>Miembros</span>
                                    {clanData.minLevel > 1 && <span className="flex items-center gap-1 text-red-400"><Lock size={10} /> Min Lvl {clanData.minLevel}</span>}
                                </h3>
                                <div className="space-y-2">
                                    {clanData.members
                                        .sort((a, b) => RANK_CONFIG[b.clanRank || 'esclavo'].value - RANK_CONFIG[a.clanRank || 'esclavo'].value)
                                        .map((member, idx) => (
                                            <ClanMemberCard
                                                key={member._id || idx}
                                                member={member}
                                                myRank={null}
                                                currentUserId={currentUserId}
                                                onUpdateRank={() => { }}
                                                onKick={() => { }}
                                            />
                                        ))
                                    }
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-zinc-950">
                            {userClanId === clanData._id ? (
                                <div className="w-full py-3 bg-green-900/20 text-green-500 font-bold rounded-xl text-center text-xs uppercase tracking-widest cursor-default border border-green-500/30 flex items-center justify-center gap-2">
                                    <Check size={16} /> Ya perteneces a este clan
                                </div>
                            ) : userClanId ? (
                                <div className="w-full py-3 bg-zinc-900 text-zinc-500 font-bold rounded-xl text-center text-xs uppercase tracking-widest cursor-default border border-zinc-800 flex items-center justify-center gap-2">
                                    <Lock size={14} /> Abandona tu clan primero
                                </div>
                            ) : (
                                <button
                                    onClick={() => onJoin(clanData._id)}
                                    className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl text-sm uppercase tracking-widest shadow-lg shadow-yellow-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <DoorOpen size={18} /> UNIRSE AHORA
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-64 text-red-500 font-bold uppercase text-xs">Error cargando datos del clan</div>
                )}
            </div>
        </div>
    );
}

function WeeklyEventWidget({ clan, onClaim, isPreview = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [showRewards, setShowRewards] = useState(false);
    if (!clan || !clan.eventStats) return null;
    const { type, total, goal, myClaims } = clan.eventStats;
    const config = EVENT_CONFIG[type] || EVENT_CONFIG.volume;
    const EventIcon = config.icon;
    const percent = Math.min((total / goal) * 100, 100);
    const milestones = [
        { tier: 1, target: goal * 0.1, label: 'Bronce', xp: 50, coins: 100 },
        { tier: 2, target: goal * 0.5, label: 'Plata', xp: 150, coins: 300 },
        { tier: 3, target: goal, label: 'Oro', xp: 500, coins: 1000 },
        { tier: 4, target: goal * 1.5, label: 'Platino', xp: 1000, coins: 2500 },
        { tier: 5, target: goal * 2, label: 'Diamante', xp: 2500, coins: 5000 }
    ];
    const sortedMembers = [...clan.members].sort((a, b) => (b.weeklyContribution || 0) - (a.weeklyContribution || 0));

    // Si es preview, el widget no hace nada al click
    if (isPreview) {
        return (
            <div className={`bg-zinc-900 border ${config.border} rounded-[32px] p-5 mb-8 relative overflow-hidden shadow-lg z-10`}>
                <div className="absolute top-0 right-0 p-12 opacity-5 bg-white blur-3xl rounded-full w-60 h-60 -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex justify-between items-center mb-3 relative z-10">
                    <div className="flex items-center gap-3"><div className={`p-2.5 rounded-xl border border-white/10 ${config.color} bg-white/5`}><EventIcon size={24} /></div><div><h3 className={`font-black text-sm uppercase italic tracking-wide ${config.color}`}>{config.title}</h3><p className="text-[10px] text-zinc-500 font-bold uppercase">Evento Activo</p></div></div><span className="text-lg font-black text-white">{percent.toFixed(1)}%</span>
                </div>
                <div className="relative h-2.5 bg-black rounded-full overflow-hidden border border-white/10"><div className={`h-full bg-gradient-to-r ${config.bg} transition-all duration-1000`} style={{ width: `${percent}%` }}></div></div>
                <p className="text-center text-[9px] text-zinc-500 font-bold mt-3 uppercase tracking-widest flex items-center justify-center gap-1">Vista Previa</p>
            </div>
        );
    }

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIsOpen(false)} />
            <div className="bg-zinc-950 w-full max-w-lg h-[80vh] rounded-[32px] border border-white/10 shadow-2xl flex flex-col relative overflow-hidden animate-in zoom-in-95 z-10">
                <div className="bg-zinc-950 p-5 border-b border-white/10 relative shrink-0 z-30">
                    <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white"><X size={20} /></button>
                    <div className="text-center mt-1">
                        <h2 className={`text-2xl font-black uppercase italic tracking-tighter flex items-center justify-center gap-2 ${config.color}`}><EventIcon size={24} /> {config.title}</h2>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Ranking Semanal</p>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between text-[10px] font-bold text-zinc-400 mb-1"><span>Progreso Clan</span><span>{total.toLocaleString()} / {goal.toLocaleString()} {config.unit}</span></div>
                        <div className="h-3 bg-black rounded-full overflow-hidden border border-white/10 relative"><div className={`h-full bg-gradient-to-r ${config.bg} transition-all duration-1000`} style={{ width: `${percent}%` }}></div></div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-black relative pb-20">
                    <div className="space-y-2">
                        {sortedMembers.map((member, index) => {
                            const rankColor = index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-orange-400' : 'text-zinc-600';
                            return (
                                <div key={member._id || index} className={cardBaseStyle}>
                                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 font-black text-lg opacity-30 ${rankColor}`}>#{index + 1}</div>
                                    <div className="flex items-center gap-3 flex-1 min-w-0 pl-8">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-xs font-black text-zinc-500 border border-white/5 overflow-hidden">{member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" alt="av" /> : member.username?.charAt(0)}</div>
                                            {member.frame && <img src={member.frame} className="absolute -top-1.5 -left-1.5 w-[52px] h-[52px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                                        </div>
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className={`text-sm font-black truncate ${index === 0 ? 'text-yellow-200' : 'text-white'}`}>{member.username}</span>
                                            <span className="text-[9px] font-bold text-zinc-500 uppercase">{member.clanRank || 'Miembro'}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-black text-white">{(member.weeklyContribution || 0).toLocaleString()}</span>
                                        <span className={`text-[8px] font-bold uppercase ${config.color}`}>{config.unit}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div onClick={() => setShowRewards(!showRewards)} className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 p-4 cursor-pointer hover:bg-zinc-800 transition-colors z-40">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3"><div className={`p-2 rounded-full ${config.bg} text-white shadow-lg`}><Gift size={20} /></div><div className="flex flex-col"><span className="text-sm font-bold text-white uppercase">Premios</span><span className="text-[10px] text-zinc-500">Toca para abrir</span></div></div><ChevronUp className={`text-zinc-500 transition-transform ${showRewards ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                {showRewards && (
                    <div className="absolute inset-0 bg-zinc-950 z-50 animate-in slide-in-from-bottom flex flex-col">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900"><h3 className="text-white font-black uppercase italic">Recompensas</h3><button onClick={() => setShowRewards(false)} className="bg-black p-2 rounded-full"><ChevronDown size={20} className="text-white" /></button></div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {milestones.map((m) => {
                                const isReached = total >= m.target; const isClaimed = myClaims && myClaims.includes(m.tier);
                                return (
                                    <div key={m.tier} className={`p-4 rounded-2xl border flex items-center justify-between ${isReached ? 'bg-yellow-900/10 border-yellow-500/30' : 'bg-black border-zinc-800 opacity-50'}`}>
                                        <div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isReached ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-600'}`}>{isClaimed ? <Check size={24} /> : <Gift size={24} />}</div><div><h4 className="text-white font-bold uppercase">{m.label}</h4><p className="text-xs text-zinc-500">{m.target.toLocaleString()} {config.unit}</p></div></div>
                                        {isReached && !isClaimed && !isPreview && (<button onClick={() => onClaim(m.tier)} className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold text-xs">RECLAMAR</button>)}
                                        {isClaimed && <span className="text-xs text-green-500 font-bold uppercase">Reclamado</span>}
                                        {isPreview && isReached && !isClaimed && <span className="text-xs text-zinc-500 font-bold uppercase"><Lock size={12} /></span>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            <div onClick={() => setIsOpen(true)} className={`bg-zinc-900 border ${config.border} rounded-[32px] p-5 mb-8 relative overflow-hidden shadow-lg cursor-pointer group active:scale-[0.99] z-10`}>
                <div className="absolute top-0 right-0 p-12 opacity-5 bg-white blur-3xl rounded-full w-60 h-60 -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex justify-between items-center mb-3 relative z-10">
                    <div className="flex items-center gap-3"><div className={`p-2.5 rounded-xl border border-white/10 ${config.color} bg-white/5`}><EventIcon size={24} /></div><div><h3 className={`font-black text-sm uppercase italic tracking-wide ${config.color}`}>{config.title}</h3><p className="text-[10px] text-zinc-500 font-bold uppercase">Evento Activo</p></div></div><span className="text-lg font-black text-white">{percent.toFixed(1)}%</span>
                </div>
                <div className="relative h-2.5 bg-black rounded-full overflow-hidden border border-white/10"><div className={`h-full bg-gradient-to-r ${config.bg} transition-all duration-1000`} style={{ width: `${percent}%` }}></div></div>
                <p className="text-center text-[9px] text-zinc-500 font-bold mt-3 uppercase tracking-widest flex items-center justify-center gap-1">Ver Ranking <ChevronDown size={12} /></p>
            </div>
            {isOpen && createPortal(modalContent, document.body)}
        </>
    );
}

// ==========================================
// 2. COMPONENTE PRINCIPAL (MAIN)
// ==========================================
export default function Social() {
    const { setUser, setIsUiHidden } = useOutletContext();
    const [activeTab, setActiveTab] = useState('ranking');
    const [searchText, setSearchText] = useState('');
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [missionInvites, setMissionInvites] = useState([]);
    const [challengeRequests, setChallengeRequests] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [myClan, setMyClan] = useState(null);
    const [clansList, setClansList] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);

    const [showCreateChallenge, setShowCreateChallenge] = useState(null);
    const [activeDuel, setActiveDuel] = useState(null);
    const [showCreateClan, setShowCreateClan] = useState(false);

    // --- ESTADO PARA EDITAR CLAN ---
    const [showEditClan, setShowEditClan] = useState(false);
    const [clanSearchText, setClanSearchText] = useState('');
    const [showOtherClans, setShowOtherClans] = useState(false);

    const [newClanData, setNewClanData] = useState({ name: '', description: '', icon: '🛡️', minLevel: 1 });
    const [myRank, setMyRank] = useState('esclavo');
    const [currentUserId, setCurrentUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showInbox, setShowInbox] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);

    const [viewingClanId, setViewingClanId] = useState(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const meRes = await api.get('/users/').catch(err => null);
                if (meRes && meRes.data) {
                    setCurrentUserId(meRes.data._id);
                    setMyRank(meRes.data.clanRank || 'esclavo');
                    const detailedUser = await api.get('/users/');
                    setMissionInvites(detailedUser.data.missionRequests || []);
                    setChallengeRequests(detailedUser.data.challengeRequests || []);
                }
                const [friendsRes, requestsRes, myClanRes, clansListRes, leaderboardRes] = await Promise.all([
                    api.get('/social/friends').catch(e => ({ data: { friends: [] } })),
                    api.get('/social/requests').catch(e => ({ data: [] })),
                    api.get('/clans/me').catch(e => ({ data: null })),
                    api.get('/clans').catch(e => ({ data: [] })),
                    api.get('/social/leaderboard').catch(e => ({ data: [] }))
                ]);
                if (friendsRes.data && Array.isArray(friendsRes.data.friends)) { setFriends(friendsRes.data.friends); } else if (Array.isArray(friendsRes.data)) { setFriends(friendsRes.data); } else { setFriends([]); }
                if (requestsRes.data && Array.isArray(requestsRes.data)) setRequests(requestsRes.data);
                if (myClanRes.data) {
                    setMyClan(myClanRes.data);
                    if (meRes && meRes.data) {
                        const meInClan = myClanRes.data.members.find(m => m && m._id === meRes.data._id);
                        if (meInClan) setMyRank(meInClan.clanRank);
                    }
                } else { setMyClan(null); }
                if (clansListRes.data) setClansList(clansListRes.data);
                if (leaderboardRes.data && Array.isArray(leaderboardRes.data)) { setLeaderboard(leaderboardRes.data); } else { setLeaderboard([]); }
            } catch (error) { console.error("Error social:", error); }
            finally { setLoading(false); }
        };
        fetchInitialData();
    }, []);

    const refreshData = async () => { try { const [myClanRes, clansListRes] = await Promise.all([api.get('/clans/me'), api.get('/clans')]); setMyClan(myClanRes.data); setClansList(clansListRes.data); } catch (e) { } };
    const requestConfirm = (message, onConfirm) => { setConfirmAction({ message, onConfirm }); };

    const handleJoinClan = async (clanId) => {
        try {
            await api.post(`/clans/${clanId}/join`);
            setToast({ message: "¡Bienvenido al clan!", type: "success" });
            setViewingClanId(null);
            setIsUiHidden(false);
            refreshData();
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Error al unirse", type: "error" });
        }
    };

    const handleSwipeRightFriend = (friend) => {
        setToast({ message: "⚔️ Duelos: Próximamente en mantenimiento", type: "info" });
    };

    const sendChallenge = async (opponentId, type, betAmount) => { try { await api.post('/challenges', { opponentId, type, betAmount }); setToast({ message: "Desafío enviado", type: "success" }); setShowCreateChallenge(null); const meRes = await api.get('/users/'); setUser(meRes.data); } catch (e) { setToast({ message: e.response?.data?.message || "Error", type: "error" }); } };
    const handleRespondChallenge = async (cid, action) => { try { await api.post('/challenges/respond', { challengeId: cid, action }); setChallengeRequests(prev => prev.filter(c => c._id !== cid)); setToast({ message: action === 'accept' ? "Aceptado" : "Rechazado", type: "success" }); if (action === 'accept') { const me = await api.get('/users/'); setUser(me.data); } } catch (e) { if (e.response?.status === 404) setChallengeRequests(prev => prev.filter(c => c._id !== cid)); } };
    const handleClaimReward = async (tier) => { try { const res = await api.post('/clans/event/claim', { tier }); setToast({ message: "Reclamado", type: "success" }); if (res.data.user) { setUser(res.data.user); localStorage.setItem('user', JSON.stringify(res.data.user)); } setMyClan(prev => ({ ...prev, eventStats: { ...prev.eventStats, myClaims: [...prev.eventStats.myClaims, tier] } })); } catch (e) { } };
    const handleCycleEvent = async () => { if (!myClan) return; const types = ['volume', 'missions', 'calories', 'xp']; const next = types[(types.indexOf(myClan.eventStats.type) + 1) % types.length]; try { await api.put('/clans/event/force', { eventType: next }); setTimeout(() => refreshData(), 500); } catch (e) { } };
    const handleUpdateRank = async (mid, rank) => { try { await api.put('/clans/rank', { memberId: mid, newRank: rank }); refreshData(); } catch (e) { } };
    const handleKickMember = async (mid) => { try { await api.post('/clans/kick', { memberId: mid }); refreshData(); } catch (e) { } };
    const handleSendRequest = async (targetId) => { try { await api.post('/social/request', { targetId }); setToast({ message: "Enviada", type: "success" }); setSearchResults(prev => prev.filter(u => u._id !== targetId)); } catch (e) { } };
    const handleRespond = async (rid, action) => { try { await api.post('/social/respond', { requesterId: rid, action }); setRequests(prev => prev.filter(r => r._id !== rid)); if (action === 'accept') { const f = await api.get('/social/friends'); setFriends(f.data.friends); } } catch (e) { } };
    const handleRemoveFriend = async (fid) => { try { await api.delete(`/social/friends/${fid}`); setFriends(prev => prev.filter(f => f._id !== fid)); } catch (e) { } };

    const handleCreateClan = async () => {
        if (!newClanData.name.trim()) {
            setToast({ message: "Falta el nombre del clan", type: "error" });
            return;
        }
        // VALIDACIÓN EMOJI
        if (!newClanData.icon.trim() || [...newClanData.icon].length > 4) {
            setToast({ message: "Elige un estandarte (1 Emoji)", type: "error" });
            return;
        }
        try {
            const res = await api.post('/clans', newClanData);
            setMyClan(res.data);
            setMyRank('dios');
            setShowCreateClan(false);
            setIsUiHidden(false);
            refreshData();
            setToast({ message: "Clan Creado!", type: "success" });
        } catch (e) { }
    };

    const handleUpdateClan = async () => {
        try {
            // await api.put(`/clans/${myClan._id}`, { ...newClanData });
            setMyClan(prev => ({ ...prev, ...newClanData }));
            setShowEditClan(false);
            setIsUiHidden(false);
            setToast({ message: "Clan actualizado", type: "success" });
        } catch (e) {
            setToast({ message: "Error al actualizar", type: "error" });
        }
    };

    const handleLeaveClan = async () => { try { await api.post('/clans/leave'); setMyClan(null); refreshData(); } catch (e) { } };
    const handleRespondMission = async (mid, action) => { try { await api.post('/missions/respond', { missionId: mid, action }); setMissionInvites(prev => prev.filter(m => m._id !== mid)); setToast({ message: "Hecho", type: "success" }); } catch (e) { } };

    useEffect(() => { const t = setTimeout(async () => { if (searchText.trim().length > 0) { setIsSearching(true); try { const res = await api.get(`/social/search?q=${encodeURIComponent(searchText)}`); setSearchResults(res.data); } catch (e) { } finally { setIsSearching(false); } } else { setSearchResults([]); } }, 500); return () => clearTimeout(t); }, [searchText]);

    const totalNotifications = requests.length + missionInvites.length + challengeRequests.length;

    // --- MANEJADORES DE MODALES FLOTANTES ---
    const openCreateClan = () => {
        setNewClanData({ name: '', description: '', icon: '🛡️', minLevel: 1 });
        setShowCreateClan(true); setIsUiHidden(true);
    };
    const closeCreateClan = () => { setShowCreateClan(false); setIsUiHidden(false); };

    const openEditClan = () => {
        if (!myClan) return;
        setNewClanData({
            name: myClan.name,
            description: myClan.description,
            icon: myClan.icon,
            minLevel: myClan.minLevel
        });
        setShowEditClan(true);
        setIsUiHidden(true);
    };
    const closeEditClan = () => { setShowEditClan(false); setIsUiHidden(false); };

    const openViewClan = (cid) => { setViewingClanId(cid); setIsUiHidden(true); };
    const closeViewClan = () => { setViewingClanId(null); setIsUiHidden(false); };

    const handleIconChange = (e) => {
        const val = e.target.value;
        const isNotLetterOrNumber = !/^[a-zA-Z0-9]*$/.test(val);
        // Permitimos borrar o si es emoji (longitud visual 1-4 chars para cubrir todos)
        if (val === '' || (isNotLetterOrNumber && [...val].length <= 4)) {
            setNewClanData({ ...newClanData, icon: val });
        }
    };

    // --- FILTRADO DE CLANES ---
    const filteredClans = clansList.filter(c =>
        c.name.toLowerCase().includes(clanSearchText.toLowerCase()) &&
        c._id !== myClan?._id
    );

    return (
        <div className="pb-24 pt-6 px-4 min-h-screen animate-in fade-in select-none bg-black relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmAction && (<div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in-95"><div className="bg-[#09090b] border border-white/10 w-full max-w-xs rounded-[24px] p-6 shadow-2xl text-center"><div className="flex justify-center mb-4 text-yellow-500"><AlertTriangle size={40} /></div><h3 className="text-white font-bold text-lg mb-2">¿Estás seguro?</h3><p className="text-zinc-400 text-sm mb-6">{confirmAction.message}</p><div className="flex gap-3"><button onClick={() => setConfirmAction(null)} className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl font-bold text-sm">Cancelar</button><button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm">Confirmar</button></div></div></div>)}

            <div className="flex justify-between items-end mb-6"><div><h1 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">SOCIAL</h1><p className="text-xs text-zinc-500 font-bold uppercase tracking-wide">Compite y Conecta</p></div><button onClick={() => setShowInbox(true)} className="bg-zinc-900 p-3 rounded-2xl text-white hover:border-yellow-500/50 border border-zinc-800 transition-all relative"><Mail size={20} />{totalNotifications > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center border border-black animate-bounce">{totalNotifications}</span>}</button></div>

            {/* Inyectamos los estilos de la animación suave */}
            <style>{customAnimationsStyle}</style>

            <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-md pt-2 pb-4 -mx-4 px-4 border-b border-white/5 mb-6"><div className="flex bg-zinc-900 p-1 rounded-2xl relative border border-white/10 overflow-hidden"><div className={`absolute top-1 bottom-1 w-[calc(33.33%-2.6px)] bg-yellow-500 rounded-xl transition-all duration-300 ease-out shadow-lg ${activeTab === 'friends' ? 'translate-x-[calc(100%+4px)]' : activeTab === 'clans' ? 'translate-x-[calc(200%+8px)]' : 'translate-x-0'}`} /><button onClick={() => setActiveTab('ranking')} className={`flex-1 z-10 font-black text-[10px] sm:text-xs flex items-center justify-center gap-1.5 py-3 rounded-xl transition-colors ${activeTab === 'ranking' ? 'text-black' : 'text-zinc-500 hover:text-white'}`}><Trophy size={14} /> RANKING</button><button onClick={() => setActiveTab('friends')} className={`flex-1 z-10 font-black text-[10px] sm:text-xs flex items-center justify-center gap-1.5 py-3 rounded-xl transition-colors ${activeTab === 'friends' ? 'text-black' : 'text-zinc-500 hover:text-white'}`}><UserPlus size={14} /> AMIGOS</button><button onClick={() => setActiveTab('clans')} className={`flex-1 z-10 font-black text-[10px] sm:text-xs flex items-center justify-center gap-1.5 py-3 rounded-xl transition-colors ${activeTab === 'clans' ? 'text-black' : 'text-zinc-500 hover:text-white'}`}><Shield size={14} /> CLANES</button></div></div>

            {activeTab === 'ranking' && (<div className="animate-in slide-in-from-left-4 fade-in duration-300">
                <MonthlyRewardsBanner />
                <div className="mb-4 px-1 flex justify-between items-center"><h3 className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Top 10 Global</h3><span className="text-[10px] text-zinc-600 font-bold uppercase bg-zinc-900 px-2 py-1 rounded">Histórico</span></div>{loading ? <div className="text-center py-20 text-zinc-600 animate-pulse font-bold text-xs uppercase">Cargando...</div> : <div className="space-y-3 pb-20">{leaderboard.slice(0, 10).map((player, index) => <RankingItem key={player._id} player={player} index={index} isMe={player._id === currentUserId} />)}</div>}
            </div>)}

            {activeTab === 'friends' && (<div className="animate-in slide-in-from-left-4 fade-in duration-300 space-y-6"><div className="relative group"><Search className="absolute left-4 top-4 text-zinc-500 group-focus-within:text-yellow-500 transition-colors" size={20} /><input type="text" placeholder="Buscar jugadores..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 pl-12 text-white focus:border-yellow-500 outline-none transition-all placeholder:text-zinc-600 font-bold text-sm" />{isSearching && <div className="absolute right-4 top-4"><Loader2 className="animate-spin text-yellow-500" size={20} /></div>}</div>{searchText.length > 0 && (<div className="space-y-3"><h3 className="text-xs font-bold text-yellow-500 uppercase ml-2">Resultados</h3>{searchResults.map(u => (<div key={u._id} className="bg-zinc-950 border border-zinc-800 p-3 rounded-2xl flex justify-between items-center"><div className="flex items-center gap-3 relative"><div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-zinc-500 border border-zinc-800 overflow-hidden relative z-10">{u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.username.charAt(0)}</div>{u.frame && <img src={u.frame} className="absolute -top-1.5 -left-1.5 w-[52px] h-[52px] max-w-none pointer-events-none z-20 drop-shadow-md" />}<span className="text-white font-bold text-sm ml-2">{u.username}</span></div><button onClick={() => handleSendRequest(u._id)} className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-xs font-black hover:bg-yellow-400">AGREGAR</button></div>))}</div>)}{searchText.length === 0 && (<div><div className="flex justify-between items-center mb-3 px-1"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tus Amigos ({friends.length})</h3><span className="text-[10px] text-green-500 font-bold bg-green-900/20 px-2 py-0.5 rounded border border-green-900/30">{friends.filter(f => f.online).length} Online</span></div>{friends.length === 0 ? (<div className="text-center py-10 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl"><Users className="mx-auto mb-2 opacity-50" /><p className="text-xs">Aún no tienes aliados.</p></div>) : (friends.map(friend => (<FriendCard key={friend._id} friend={friend} onRemoveRequest={(f) => requestConfirm(`¿Eliminar a ${f.username}?`, () => handleRemoveFriend(f._id))} onChallengeOrView={handleSwipeRightFriend} />)))}</div>)}</div>)}

            {activeTab === 'clans' && (
                <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-8 pb-20">

                    {/* 1. TU CLAN (O CREAR) - AHORA ARRIBA */}
                    <div>
                        <h3 className="text-xs font-black text-zinc-500 uppercase ml-2 mb-3 tracking-widest">Tu Alianza</h3>

                        {myClan ? (
                            <div className="bg-zinc-900 border border-white/10 rounded-[32px] p-6 relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 p-10 opacity-10 bg-purple-500 blur-3xl rounded-full w-40 h-40 -mr-10 -mt-10"></div>

                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="text-4xl bg-black w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner border border-zinc-800">{myClan.icon}</div>
                                        <div>
                                            <h2 className="text-2xl font-black text-white uppercase italic">{myClan.name}</h2>

                                            {/* 🔥 PODER EN CÍRCULO CON RAYO (FIX 3) */}
                                            <div className="flex items-center gap-4 mt-2">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                                                        <Zap size={14} fill="currentColor" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-purple-300 leading-none">{myClan.totalPower}</span>
                                                        <span className="text-[8px] font-bold text-zinc-500 uppercase">Poder</span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                                                    <Users size={12} /> {myClan.members.length} Miembros
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="absolute top-0 right-0 flex gap-2">
                                        {/* BOTÓN EDITAR (SOLO LÍDER) - Flotando arriba derecha */}
                                        {((myClan.leader?._id || myClan.leader) === currentUserId) && (
                                            <button onClick={openEditClan} className="bg-zinc-800 p-2 rounded-xl text-zinc-400 border border-white/5 hover:text-white hover:bg-zinc-700 transition-colors">
                                                <Edit size={16} />
                                            </button>
                                        )}

                                        {/* BOTÓN SALIR (ROJO) */}
                                        <button onClick={() => requestConfirm("¿Salir del clan?", handleLeaveClan)} className="bg-red-900/20 p-2 rounded-xl text-red-500 border border-red-500/30 hover:bg-red-900/40 transition-colors">
                                            <LogOut size={16} />
                                        </button>
                                    </div>
                                </div>

                                {myClan.eventStats && (<div className="mb-6 relative z-10"><WeeklyEventWidget clan={myClan} onClaim={handleClaimReward} /></div>)}

                                <div>
                                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3">Miembros</h3>
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {myClan.members.filter(m => m).sort((a, b) => RANK_CONFIG[b.clanRank || 'esclavo'].value - RANK_CONFIG[a.clanRank || 'esclavo'].value).map((member, index) => (
                                            <ClanMemberCard key={member._id || index} member={member} myRank={myRank} currentUserId={currentUserId} onUpdateRank={handleUpdateRank} onKick={(m) => requestConfirm(`¿Expulsar a ${m.username}?`, () => handleKickMember(m._id))} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] flex items-center justify-between shadow-xl relative overflow-hidden group">
                                <div className="relative z-10">
                                    <h3 className="text-white font-black text-lg uppercase flex items-center gap-2"><Crown size={20} className="text-yellow-500" /> Crea tu Clan</h3>
                                    <p className="text-xs text-zinc-400 mt-1">Lidera y conquista.</p>
                                </div>
                                <button onClick={openCreateClan} className="bg-white text-black px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-transform relative z-10 hover:bg-zinc-200">CREAR</button>
                            </div>
                        )}
                    </div>

                    {/* 2. BOTÓN EXPLORAR OTROS CLANES (DEBAJO) */}
                    <div>
                        <button
                            onClick={() => setShowOtherClans(!showOtherClans)}
                            className="w-full py-4 bg-yellow-500 border border-yellow-600 rounded-2xl flex items-center justify-center gap-2 text-black hover:brightness-110 transition-all text-xs font-black uppercase tracking-widest active:scale-98 shadow-lg"
                        >
                            <Globe size={18} /> {showOtherClans ? 'Ocultar Explorador' : 'Explorar Otros Clanes'} {showOtherClans ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {showOtherClans && (
                            <div className="mt-4 animate-in slide-in-from-top-2 fade-in">
                                <div className="relative group mb-4">
                                    <Search className="absolute left-4 top-4 text-zinc-500 group-focus-within:text-yellow-500 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Buscar alianza..."
                                        value={clanSearchText}
                                        onChange={(e) => setClanSearchText(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-[24px] p-4 pl-12 text-white focus:border-yellow-500/50 outline-none transition-all placeholder:text-zinc-700 font-bold text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="text-[10px] font-black text-zinc-600 uppercase ml-2 mb-1 flex justify-between">
                                        <span>{clanSearchText ? 'Resultados' : 'Destacados'}</span>
                                    </div>

                                    {filteredClans.slice(0, clanSearchText ? undefined : 3).map((clan, i) => (
                                        <div key={clan._id} onClick={() => openViewClan(clan._id)} className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex items-center justify-between cursor-pointer hover:border-zinc-700 transition-colors active:scale-98 h-16">
                                            <div className="flex items-center gap-3">
                                                <div className="text-xl filter drop-shadow-md w-8 text-center">{clan.icon}</div>
                                                <div>
                                                    <h3 className="text-zinc-300 font-bold text-xs uppercase">{clan.name}</h3>
                                                    <span className="text-[9px] text-zinc-600">{clan.memberCount} Miembros</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pr-2">
                                                <span className="text-[10px] font-black text-purple-500/70">{clan.totalPower}</span>
                                                <Eye size={14} className="text-zinc-700" />
                                            </div>
                                        </div>
                                    ))}

                                    {filteredClans.length === 0 && (
                                        <div className="text-center py-4 text-zinc-700 text-[10px] italic">No se encontraron clanes.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showInbox && (<div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"><div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative flex flex-col max-h-[70vh]"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-white flex items-center gap-2"><Bell className="text-yellow-500" /> Notificaciones</h2><button onClick={() => setShowInbox(false)} className="bg-black/50 p-2 rounded-full text-zinc-500 hover:text-white"><X size={20} /></button></div><div className="space-y-4 overflow-y-auto flex-1 custom-scrollbar">{missionInvites.length > 0 && (<div><h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">Misiones Coop</h3>{missionInvites.map(m => (<div key={m._id} className="bg-blue-900/10 p-3 rounded-2xl border border-blue-900/30 flex justify-between items-center mb-2"><div><p className="text-white font-bold text-sm">{m.title}</p><p className="text-[10px] text-blue-400">{m.frequency}</p></div><div className="flex gap-2"><button onClick={() => handleRespondMission(m._id, 'reject')} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white"><X size={14} /></button><button onClick={() => handleRespondMission(m._id, 'accept')} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"><Check size={14} /></button></div></div>))}</div>)}<div><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Solicitudes Amistad</h3>{requests.length === 0 && <p className="text-[10px] text-zinc-600 italic">Nada por aquí.</p>}{requests.map(req => (<div key={req._id} className="bg-black p-3 rounded-2xl border border-zinc-800 flex justify-between items-center mb-2"><span className="text-white font-bold text-sm">{req.username}</span><div className="flex gap-2"><button onClick={() => handleRespond(req._id, 'reject')} className="p-2 bg-zinc-800 text-red-500 rounded-lg"><X size={14} /></button><button onClick={() => handleRespond(req._id, 'accept')} className="p-2 bg-zinc-800 text-green-500 rounded-lg"><Check size={14} /></button></div></div>))}</div></div></div></div>)}

            {showCreateChallenge && <CreateChallengeModal friend={showCreateChallenge} onClose={() => setShowCreateChallenge(null)} onSend={sendChallenge} />}
            {activeDuel && <DuelStatusModal duel={activeDuel} userId={currentUserId} onClose={() => setActiveDuel(null)} />}

            {/* MODAL CREAR / EDITAR CLAN (UNIFICADO) */}
            {(showCreateClan || showEditClan) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={showEditClan ? closeEditClan : closeCreateClan} />

                    <div className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl relative z-10 animate-in zoom-in-95">

                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-zinc-950">
                            <h3 className="text-xl font-black text-white flex items-center gap-2 uppercase italic">
                                {showEditClan ? <><Edit className="text-blue-500" /> Editar Clan</> : <><Crown className="text-yellow-500" /> Fundar Clan</>}
                            </h3>
                            <button onClick={showEditClan ? closeEditClan : closeCreateClan} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white transition-colors border border-white/5"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar bg-black/20">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Nombre del Clan</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Los Espartanos"
                                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white font-bold focus:border-yellow-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={newClanData.name}
                                    onChange={e => setNewClanData({ ...newClanData, name: e.target.value })}
                                    disabled={showEditClan} // 🔒 NOMBRE NO EDITABLE
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Lema / Descripción</label>
                                <textarea rows="2" placeholder="Honor y Gloria..." className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-xs font-medium focus:border-yellow-500 outline-none transition-colors resize-none" value={newClanData.description} onChange={e => setNewClanData({ ...newClanData, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Nivel Mínimo</label>
                                <div className="flex items-center gap-3">
                                    <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl"><Lock size={20} className="text-zinc-600" /></div>
                                    <input type="number" min="1" max="100" className="flex-1 bg-black border border-zinc-800 rounded-xl p-3 text-white font-bold focus:border-yellow-500 outline-none transition-colors text-center" value={newClanData.minLevel} onChange={e => setNewClanData({ ...newClanData, minLevel: parseInt(e.target.value) || 1 })} />
                                </div>
                            </div>

                            {/* 4. EMOJI INPUT (PERSONALIZADO) */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-2">Estandarte (Emoji)</label>
                                <div className="flex justify-center">
                                    <input
                                        type="text"
                                        value={newClanData.icon}
                                        onChange={handleIconChange}
                                        className="w-24 h-24 bg-black border-2 border-zinc-800 rounded-3xl text-center text-6xl focus:border-yellow-500 outline-none transition-all shadow-inner"
                                        placeholder="🛡️"
                                    />
                                </div>
                                <p className="text-[9px] text-zinc-600 text-center mt-2">Usa el teclado de emojis de tu móvil</p>
                            </div>
                        </div>

                        <div className="p-5 bg-zinc-950 border-t border-white/10">
                            <button
                                onClick={showEditClan ? handleUpdateClan : handleCreateClan}
                                className={`w-full font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 border-b-4 uppercase tracking-widest ${showEditClan ? 'bg-blue-600 hover:bg-blue-500 border-blue-800 text-white' : 'bg-yellow-500 hover:bg-yellow-400 border-yellow-600 text-black'}`}
                            >
                                {showEditClan ? <><Edit size={18} /> GUARDAR CAMBIOS</> : <><Shield size={18} /> CREAR CLAN</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewingClanId && (<ClanPreviewModal clanId={viewingClanId} currentUserId={currentUserId} userClanId={myClan?._id} onClose={closeViewClan} onJoin={handleJoinClan} />)}
        </div>
    );
}