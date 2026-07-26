import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { Users, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import Toast from '../../components/common/Toast';
import SocialSubHeader from '../../components/social/SocialSubHeader';
import FriendCard from '../../components/social/FriendCard';
import { customAnimationsStyle } from '../../utils/socialHelpers';

const fetcher = (url) => api.get(url).then(res => res.data);

export default function FriendsPage() {
    const navigate = useNavigate();
    const { data, mutate, isLoading } = useSWR('/social/friends', fetcher, {
        // La bolita de online depende de `lastActive`, así que refrescamos
        // periódicamente para que el estado no se quede congelado.
        refreshInterval: 60000,
        revalidateOnFocus: true
    });

    const [toast, setToast] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);

    const friends = data?.friends || [];
    const onlineCount = friends.filter(f => f.online).length;

    const handleRemoveFriend = async (fid) => {
        mutate(prev => ({ ...prev, friends: (prev?.friends || []).filter(f => f._id !== fid) }), false);
        try {
            await api.delete(`/social/friends/${fid}`);
            setToast({ message: 'Amigo eliminado', type: 'info' });
        } catch (e) {
            mutate();
            setToast({ message: 'No se pudo eliminar al amigo', type: 'error' });
        }
    };

    return (
        <div className="pb-24 pt-6 px-4 min-h-screen animate-in fade-in select-none bg-black">
            <style>{customAnimationsStyle}</style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <SocialSubHeader
                title="Amigos"
                subtitle={`${friends.length} aliados · ${onlineCount} online`}
                icon={Users}
                right={
                    <span className="text-[10px] text-green-500 font-bold bg-green-900/20 px-2.5 py-1 rounded-lg border border-green-900/30 shrink-0 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]"></span>
                        {onlineCount}
                    </span>
                }
            />

            {isLoading && !data ? (
                <div className="text-center py-20 text-zinc-500 animate-pulse uppercase text-xs font-bold">Cargando amigos...</div>
            ) : friends.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
                    <Users className="mx-auto mb-3 opacity-50" size={32} />
                    <p className="text-xs mb-4">Aún no tienes aliados.</p>
                    <button onClick={() => navigate('/social')} className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-yellow-400 transition-colors">
                        Buscar en el Feed
                    </button>
                </div>
            ) : (
                <>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-3 ml-2">
                        Desliza una tarjeta para eliminar
                    </p>
                    {friends.map(friend => (
                        <FriendCard
                            key={friend._id}
                            friend={friend}
                            onViewProfile={(id) => navigate(`/social/user/${id}`)}
                            onRemoveRequest={(f) => setConfirmAction({
                                message: `¿Eliminar a ${f.username} de tus amigos?`,
                                onConfirm: () => handleRemoveFriend(f._id)
                            })}
                            onChallengeOrView={() => setToast({ message: '⚔️ Duelos: próximamente', type: 'info' })}
                        />
                    ))}
                </>
            )}

            {confirmAction && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in-95">
                    <div className="bg-[#09090b] border border-white/10 w-full max-w-xs rounded-[24px] p-6 shadow-2xl text-center">
                        <div className="flex justify-center mb-4 text-yellow-500"><AlertTriangle size={40} /></div>
                        <h3 className="text-white font-bold text-lg mb-2">¿Estás seguro?</h3>
                        <p className="text-zinc-400 text-sm mb-6">{confirmAction.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl font-bold text-sm">Cancelar</button>
                            <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
