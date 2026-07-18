import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Users, Utensils, Dumbbell, Plus, ShoppingBag, Gamepad2, ScrollText, Home } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export default function Footer() {
    const user = useAuthStore(state => state.user);
    const location = useLocation();
    
    // Solo manejamos el botón central (+)
    const [isFabOpen, setIsFabOpen] = useState(false);

    // Cierra el menú al cambiar de ruta
    useEffect(() => {
        setIsFabOpen(false);
    }, [location.pathname]);

    // Bloqueo de scroll para inmersión del menú +
    useEffect(() => {
        if (isFabOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isFabOpen]);

    const notificationCount = (user?.friendRequests?.length || 0) +
        (user?.missionRequests?.length || 0) +
        (user?.challengeRequests?.length || 0);

    const hasNotifications = notificationCount > 0;

    const navItemsLeft = [
        { name: 'IG', path: '/social', icon: Users, hasBadge: hasNotifications },
        { name: 'Comida', path: '/food', icon: Utensils },
    ];

    const navItemsRight = [
        { name: 'Gym', path: '/gym', icon: Dumbbell },
        { name: 'Inicio', path: '/home', icon: Home },
    ];

    return (
        <>
            {/* --- OVERLAY GLOBAL OSCURO PARA EL BOTÓN + --- */}
            <div
                className={`fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-all duration-400 ease-out ${isFabOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsFabOpen(false)}
            />

            {/* --- MENÚ RADIAL FLOTANTE (BOTÓN +) --- */}
            <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 flex items-end justify-center gap-6 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-40 pointer-events-none ${isFabOpen ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto' : 'translate-y-12 opacity-0 scale-50'}`}>
                <NavLink to="/shop" className="flex flex-col items-center gap-2 group">
                    <div className="w-14 h-14 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-transform group-hover:scale-110 group-active:scale-95 bg-black/50">
                        <ShoppingBag size={24} />
                    </div>
                    <span className="text-[10px] font-black tracking-widest uppercase text-yellow-100/70 drop-shadow-md">Tienda</span>
                </NavLink>

                <NavLink to="/games" className="flex flex-col items-center gap-2 group -translate-y-6">
                    <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-transform group-hover:scale-110 group-active:scale-95 bg-black/50">
                        <Gamepad2 size={28} />
                    </div>
                    <span className="text-[10px] font-black tracking-widest uppercase text-purple-100/70 drop-shadow-md">Juegos</span>
                </NavLink>

                <NavLink to="/missions" className="flex flex-col items-center gap-2 group">
                    <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-transform group-hover:scale-110 group-active:scale-95 bg-black/50">
                        <ScrollText size={24} />
                    </div>
                    <span className="text-[10px] font-black tracking-widest uppercase text-green-100/70 drop-shadow-md">Misiones</span>
                </NavLink>
            </div>

            {/* --- BARRA DE NAVEGACIÓN INFERIOR --- */}
            <nav className="fixed bottom-0 left-0 w-full bg-black/95 backdrop-blur-lg border-t border-white/10 safe-bottom pt-2 pb-2 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
                <div className="flex justify-between items-center px-4 h-full relative">
                    
                    {/* Items Izquierda (IG, Comida) */}
                    <div className="flex w-[40%] justify-around">
                        {navItemsLeft.map((item) => (
                            <NavLink key={item.name} to={item.path} className="group relative w-12 flex justify-center">
                                {({ isActive }) => (
                                    <div className={`flex flex-col items-center justify-center transition-all duration-300 ${isActive ? 'text-yellow-400 scale-110 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                        <div className="relative">
                                            <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                            {item.hasBadge && (
                                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black animate-pulse"></span>
                                            )}
                                        </div>
                                        <span className={`text-[9px] mt-1 font-bold tracking-wide transition-colors uppercase ${isActive ? 'text-yellow-500' : 'text-zinc-600'}`}>
                                            {item.name}
                                        </span>
                                    </div>
                                )}
                            </NavLink>
                        ))}
                    </div>

                    {/* BOTÓN CENTRAL FLOTANTE (+) */}
                    <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex justify-center w-[20%]">
                        <button
                            onClick={() => setIsFabOpen(!isFabOpen)}
                            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all duration-300 z-50 border-4 border-black
                                ${isFabOpen 
                                    ? 'bg-zinc-800 text-zinc-400 scale-90 rotate-45 border-zinc-900 shadow-none' 
                                    : 'bg-gradient-to-tr from-yellow-600 to-yellow-400 text-black hover:scale-105 active:scale-95'
                                }
                            `}
                        >
                            <Plus size={28} strokeWidth={3} className="transition-transform duration-300" />
                        </button>
                    </div>

                    {/* Items Derecha (Gym, Inicio) */}
                    <div className="flex w-[40%] justify-around">
                        {navItemsRight.map((item) => (
                            <NavLink key={item.name} to={item.path} className="group relative w-12 flex justify-center">
                                {({ isActive }) => (
                                    <div className={`flex flex-col items-center justify-center transition-all duration-300 ${isActive ? 'text-yellow-400 scale-110 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                        <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                        <span className={`text-[9px] mt-1 font-bold tracking-wide transition-colors uppercase ${isActive ? 'text-yellow-500' : 'text-zinc-600'}`}>
                                            {item.name}
                                        </span>
                                    </div>
                                )}
                            </NavLink>
                        ))}
                    </div>

                </div>
            </nav>
        </>
    );
}