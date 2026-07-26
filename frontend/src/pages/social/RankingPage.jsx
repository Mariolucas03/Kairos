import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { Trophy, Calendar, Globe } from 'lucide-react';
import api from '../../services/api';
import SocialSubHeader from '../../components/social/SocialSubHeader';
import RankingItem from '../../components/social/RankingItem';
import MonthlyRewardsBanner from '../../components/social/MonthlyRewardsBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { customAnimationsStyle } from '../../utils/socialHelpers';

const fetcher = (url) => api.get(url).then(res => res.data);

export default function RankingPage() {
    const navigate = useNavigate();
    const user = useAuthStore(state => state.user);
    const currentUserId = user?._id;

    // 'monthly' = XP ganado este mes (el que reparte los premios)
    // 'global'  = nivel/XP acumulado histórico
    const [mode, setMode] = useState('monthly');

    const { data: monthlyData, isLoading: loadingMonthly } = useSWR('/social/leaderboard/monthly', fetcher);
    const { data: globalData, isLoading: loadingGlobal } = useSWR('/social/leaderboard', fetcher);
    const { data: friendsData } = useSWR('/social/friends', fetcher);

    const friendIdSet = new Set((friendsData?.friends || []).map(f => f._id));

    const isMonthly = mode === 'monthly';
    const list = isMonthly ? (monthlyData?.ranking || []) : (globalData || []);
    const loading = isMonthly ? (loadingMonthly && !monthlyData) : (loadingGlobal && !globalData);

    const periodLabel = monthlyData?.period
        ? new Date(`${monthlyData.period}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
        : '';

    return (
        <div className="pb-24 pt-6 px-4 min-h-screen animate-in fade-in select-none bg-black">
            <style>{customAnimationsStyle}</style>

            <SocialSubHeader
                title="Ranking"
                subtitle={isMonthly ? `Mes de ${periodLabel}` : 'Clasificación histórica'}
                icon={Trophy}
            />

            {/* Selector Mensual / Global */}
            <div className="flex bg-zinc-900 p-1 rounded-2xl relative border border-white/10 mb-6">
                <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-yellow-500 rounded-xl transition-transform duration-300 ease-out shadow-lg ${isMonthly ? 'translate-x-0' : 'translate-x-[calc(100%+8px)]'}`} />
                <button onClick={() => setMode('monthly')} className={`flex-1 z-10 font-black text-[11px] flex items-center justify-center gap-1.5 py-3 rounded-xl transition-colors ${isMonthly ? 'text-black' : 'text-zinc-500 hover:text-white'}`}>
                    <Calendar size={14} /> MENSUAL
                </button>
                <button onClick={() => setMode('global')} className={`flex-1 z-10 font-black text-[11px] flex items-center justify-center gap-1.5 py-3 rounded-xl transition-colors ${!isMonthly ? 'text-black' : 'text-zinc-500 hover:text-white'}`}>
                    <Globe size={14} /> GLOBAL
                </button>
            </div>

            {isMonthly && <MonthlyRewardsBanner />}

            <div className="mb-4 px-1 flex justify-between items-center">
                <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-widest">
                    {isMonthly ? 'Top XP del mes' : 'Top 10 Global'}
                </h3>
                <span className="text-[10px] text-zinc-600 font-bold uppercase bg-zinc-900 px-2 py-1 rounded">
                    {isMonthly ? 'Se reinicia cada mes' : 'Histórico'}
                </span>
            </div>

            {loading ? (
                <div className="text-center py-20 text-zinc-500 animate-pulse uppercase text-xs font-bold">Cargando ranking...</div>
            ) : list.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
                    <Trophy className="mx-auto mb-3 opacity-50" size={32} />
                    <p className="text-xs">
                        {isMonthly ? 'Todavía nadie ha ganado XP este mes. ¡Sé el primero!' : 'Sin datos de ranking.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3 pb-10">
                    {(isMonthly ? list : list.slice(0, 10)).map((player, index) => (
                        <RankingItem
                            key={player._id}
                            player={player}
                            index={index}
                            isMe={player._id === currentUserId}
                            isViewable={friendIdSet.has(player._id)}
                            onViewProfile={(id) => navigate(`/social/user/${id}`)}
                            metricLabel={isMonthly ? 'XP mes' : 'XP'}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
