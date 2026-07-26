import { Bell, X, Check } from 'lucide-react';

export default function InboxModal({ requests = [], missionInvites = [], onClose, onRespondFriend, onRespondMission }) {
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative flex flex-col max-h-[70vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><Bell className="text-yellow-500" /> Notificaciones</h2>
                    <button onClick={onClose} className="bg-black/50 p-2 rounded-full text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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
                        {requests.length === 0 && <p className="text-[10px] text-zinc-600 italic">Nada por aquí.</p>}
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
