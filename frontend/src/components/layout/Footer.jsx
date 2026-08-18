import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Rss, Utensils, Dumbbell, Plus, ShoppingBag, Gamepad2, ScrollText, Home } from 'lucide-react';
import useSocialBadge from '../../hooks/useSocialBadge';

export default function Footer() {
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

    // 🔴 El punto rojo del icono de IG. Antes se calculaba desde el usuario
    // guardado en el navegador, que no se actualizaba solo y nunca incluía los
    // me gusta ni los comentarios: ahora sale del mismo contador que el buzón.
    const { total: avisos } = useSocialBadge();
    const hasNotifications = avisos > 0;

    // Cada icono del footer es el mismo que usa esa sección en su propia
    // cabecera. El de IG era `Users`, que se leía como "amigos" cuando en
    // realidad lleva al feed —y los amigos son solo una pestaña de dentro.
    const navItemsLeft = [
        { name: 'IG', path: '/social', icon: Rss, hasBadge: hasNotifications },
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
                    {/* Mismo chasis que las tarjetas: superficie plana, borde al
                        7% y el color SOLO en el icono. Antes cada acceso llevaba
                        fondo de color al 20%, borde encendido y halo exterior. */}
                    <div className="w-14 h-14 rounded-full bg-[#0a0a0c] border border-white/[0.07] flex items-center justify-center transition-transform group-hover:scale-110 group-active:scale-95" style={{ color: '#eab308' }}>
                        <ShoppingBag size={24} />
                    </div>
                    <span className="text-[10px] font-black tracking-[0.16em] uppercase text-zinc-400 not-italic">Tienda</span>
                </NavLink>

                <NavLink to="/games" className="flex flex-col items-center gap-2 group -translate-y-6">
                    <div className="w-16 h-16 rounded-full bg-[#0a0a0c] border border-white/[0.07] flex items-center justify-center transition-transform group-hover:scale-110 group-active:scale-95" style={{ color: '#a855f7' }}>
                        <Gamepad2 size={28} />
                    </div>
                    <span className="text-[10px] font-black tracking-[0.16em] uppercase text-zinc-400 not-italic">Juegos</span>
                </NavLink>

                <NavLink to="/missions" className="flex flex-col items-center gap-2 group">
                    <div className="w-14 h-14 rounded-full bg-[#0a0a0c] border border-white/[0.07] flex items-center justify-center transition-transform group-hover:scale-110 group-active:scale-95" style={{ color: '#22c55e' }}>
                        <ScrollText size={24} />
                    </div>
                    <span className="text-[10px] font-black tracking-[0.16em] uppercase text-zinc-400 not-italic">Misiones</span>
                </NavLink>
            </div>

            {/* --- BARRA DE NAVEGACIÓN INFERIOR --- */}
            <nav className="fixed bottom-0 left-0 w-full bg-black/95 backdrop-blur-lg border-t border-white/[0.07] safe-bottom pt-2 pb-2 z-50">
                <div className="flex justify-between items-center px-4 h-full relative">
                    
                    {/* Items Izquierda (IG, Comida) */}
                    <div className="flex w-[40%] justify-around">
                        {navItemsLeft.map((item) => (
                            <NavLink key={item.name} to={item.path} className="group relative w-12 flex justify-center">
                                {({ isActive }) => (
                                    <div className={`flex flex-col items-center justify-center transition-all duration-300 ${isActive ? 'text-yellow-500' : 'text-zinc-600 hover:text-zinc-400'}`}>
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
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 z-50 border-4 border-black
                                ${isFabOpen 
                                    ? 'bg-zinc-800 text-zinc-400 scale-90 rotate-45 border-zinc-900 shadow-none' 
                                    : 'bg-yellow-500 text-black hover:scale-105 active:scale-95'
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
                                    <div className={`flex flex-col items-center justify-center transition-all duration-300 ${isActive ? 'text-yellow-500' : 'text-zinc-600 hover:text-zinc-400'}`}>
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