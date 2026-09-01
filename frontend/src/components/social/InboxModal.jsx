import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, Heart, MessageCircle, Swords, Club } from 'lucide-react';

// Tiempo relativo corto para la lista de avisos
const hace = (fecha) => {
    const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const horas = Math.floor(mins / 60);
    if (horas < 24) return `${horas}h`;
    return `${Math.floor(horas / 24)}d`;
};

export default function InboxModal({
    requests = [],
    missionInvites = [],
    retosCartas = [],
    mesasPoker = [],
    notifications = [],
    onClose,
    onRespondFriend,
    onRespondMission,
    onRespondReto,
    onRespondPoker
}) {
    const navigate = useNavigate();
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative flex flex-col max-h-[70vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><Bell className="text-yellow-500" /> Notificaciones</h2>
                    <button onClick={onClose} className="bg-black/50 p-2 rounded-full text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                    {/* --- MESAS DE PÓQUER --- */}
                    {mesasPoker.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#2f8f5b' }}>
                                Mesas de póquer
                            </h3>
                            {mesasPoker.map(r => (
                                <div key={r._id} className="p-3 rounded-2xl border flex justify-between items-center mb-2" style={{ background: 'rgba(47,143,91,0.08)', borderColor: 'rgba(47,143,91,0.3)' }}>
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                        <Club size={16} style={{ color: '#2f8f5b' }} className="shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-white font-bold text-sm truncate">{r.de}</p>
                                            <p className="text-[10px]" style={{ color: '#2f8f5b' }}>Entrada {r.entrada} · ciega {r.ciegaGrande}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => onRespondPoker(r._id, 'rechazar')} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white"><X size={14} /></button>
                                        <button onClick={() => onRespondPoker(r._id, 'aceptar')} className="p-2 text-black rounded-lg" style={{ background: '#2f8f5b' }}><Check size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* --- RETOS A CARTA ALTA ---
                        Van los primeros: hay fichas de por medio y alguien esta
                        esperando al otro lado a que contestes. */}
                    {retosCartas.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#c9822b' }}>
                                Retos a Carta Alta
                            </h3>
                            {retosCartas.map(r => (
                                <div key={r._id} className="p-3 rounded-2xl border flex justify-between items-center mb-2" style={{ background: 'rgba(201,130,43,0.08)', borderColor: 'rgba(201,130,43,0.3)' }}>
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                        <Swords size={16} style={{ color: '#c9822b' }} className="shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-white font-bold text-sm truncate">{r.de}</p>
                                            <p className="text-[10px]" style={{ color: '#c9822b' }}>{r.apuesta} fichas por mano</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => onRespondReto(r._id, 'rechazar')} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white"><X size={14} /></button>
                                        <button onClick={() => onRespondReto(r._id, 'aceptar')} className="p-2 text-black rounded-lg" style={{ background: '#c9822b' }}><Check size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* --- ME GUSTA Y COMENTARIOS --- */}
                    {notifications.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-pink-500 uppercase tracking-widest mb-2">Actividad</h3>
                            {notifications.map(n => (
                                <button
                                    key={n._id}
                                    onClick={() => { onClose(); if (n.actor?._id) navigate(`/social/user/${n.actor._id}`); }}
                                    className={`w-full text-left p-3 rounded-2xl border flex items-center gap-3 mb-2 transition-colors ${n.read ? 'bg-black border-zinc-800' : 'bg-pink-900/10 border-pink-500/20'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500 overflow-hidden shrink-0">
                                        {n.actor?.avatar
                                            ? <img src={n.actor.avatar} className="w-full h-full object-cover" alt="av" />
                                            : n.actor?.username?.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-zinc-300 leading-tight">
                                            <span className="font-black text-white">{n.actor?.username || 'Alguien'}</span>
                                            {n.type === 'like'
                                                ? ' le ha dado me gusta a tu entreno'
                                                : ' ha comentado tu entreno'}
                                            {n.workoutName ? <span className="text-zinc-500"> "{n.workoutName}"</span> : null}
                                        </p>
                                        {n.type === 'comment' && n.text && (
                                            <p className="text-[10px] text-zinc-500 not-italic truncate mt-0.5">"{n.text}"</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        {n.type === 'like'
                                            ? <Heart size={14} className="text-red-500 fill-red-500" />
                                            : <MessageCircle size={14} className="text-blue-400" />}
                                        <span className="text-[9px] text-zinc-600 font-bold">{hace(n.createdAt)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {missionInvites.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">Misiones Coop</h3>
                            {missionInvites.map(m => (
                                <div key={m._id} className="bg-blue-900/10 p-3 rounded-2xl border border-blue-900/30 flex justify-between items-center mb-2">
                                    <div className="min-w-0 pr-2">
                                        <p className="text-white font-bold text-sm truncate">{m.title}</p>
                                        <p className="text-[10px] text-blue-400">{m.frequency}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => onRespondMission(m._id, 'reject')} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white"><X size={14} /></button>
                                        <button onClick={() => onRespondMission(m._id, 'accept')} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"><Check size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Solicitudes Amistad</h3>
                        {requests.length === 0 && <p className="text-[10px] text-zinc-600 not-italic">Nada por aquí.</p>}
                        {requests.map(req => (
                            <div key={req._id} className="bg-black p-3 rounded-2xl border border-zinc-800 flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500 overflow-hidden shrink-0">
                                        {req.avatar ? <img src={req.avatar} className="w-full h-full object-cover" alt="av" /> : req.username?.charAt(0)}
                                    </div>
                                    <span className="text-white font-bold text-sm truncate">{req.username}</span>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => onRespondFriend(req._id, 'reject')} className="p-2 bg-zinc-800 text-red-500 rounded-lg hover:bg-red-900/30"><X size={14} /></button>
                                    <button onClick={() => onRespondFriend(req._id, 'accept')} className="p-2 bg-zinc-800 text-green-500 rounded-lg hover:bg-green-900/30"><Check size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
