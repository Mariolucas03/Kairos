import { NavLink } from 'react-router-dom';
import { Home, ScrollText, Utensils, Dumbbell, Users } from 'lucide-react';

export default function Footer({ user }) {

    // 🔥 CÁLCULO DE NOTIFICACIONES (PUNTO ROJO)
    const notificationCount = (user?.friendRequests?.length || 0) +
        (user?.missionRequests?.length || 0) +
        (user?.challengeRequests?.length || 0);

    const hasNotifications = notificationCount > 0;

    const navItems = [
        { name: 'Inicio', path: '/home', icon: Home },
        { name: 'Misiones', path: '/missions', icon: ScrollText },
        { name: 'Comida', path: '/food', icon: Utensils },
        { name: 'Gym', path: '/gym', icon: Dumbbell },
        { name: 'Social', path: '/social', icon: Users, hasBadge: hasNotifications },
    ];

    return (
        <nav className="fixed bottom-0 left-0 w-full bg-black/95 backdrop-blur-lg border-t border-white/10 safe-bottom pt-1 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
            <ul className="flex justify-between items-center px-1 h-full">
                {navItems.map((item) => (
                    <li key={item.name} className="flex-1">
                        <NavLink to={item.path} className="w-full block py-1 group relative">
                            {({ isActive }) => (
                                <div
                                    className={`flex flex-col items-center justify-center w-full transition-all duration-300 ${isActive
                                        ? 'text-yellow-400 scale-110 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]'
                                        : 'text-zinc-600 hover:text-zinc-300'
                                        }`}
                                >
                                    {/* CONTENEDOR ICONO + BADGE */}
                                    <div className="relative">
                                        <item.icon
                                            size={22}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className="transition-all duration-300"
                                        />

                                        {/* 🔥 PUNTO ROJO DE NOTIFICACIÓN */}
                                        {item.hasBadge && (
                                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black animate-pulse"></span>
                                        )}
                                    </div>

                                    <span
                                        className={`text-[9px] mt-0.5 font-bold tracking-wide transition-colors ${isActive ? 'text-yellow-500' : 'text-zinc-700'
                                            }`}
                                    >
                                        {item.name}
                                    </span>
                                </div>
                            )}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
}