import { useState } from 'react';
import { Skull, Lock, CheckCircle, RefreshCcw } from 'lucide-react';
import api from '../../services/api';

export default function RedemptionScreen({ user, setUser }) {
    const [loading, setLoading] = useState(false);

    const handleRevive = async () => {
        setLoading(true);
        try {
            // 1. Petición al backend para revivir (HP sube a 20)
            const res = await api.post('/users/revive');

            // 2. Guardamos los datos nuevos en localStorage (CRUCIAL)
            localStorage.setItem('user', JSON.stringify(res.data.user));

            // 3. Intentamos actualizar el estado de React
            if (setUser) setUser(res.data.user);

            // 4. REINICIO FORZADO DEL SISTEMA
            // Esto obliga a la app a recargarse, leer el localStorage nuevo
            // y darse cuenta de que ya no tienes 0 de vida, quitando la pantalla roja.
            window.location.reload();

        } catch (error) {
            console.error("Error al revivir:", error);
            // Si falla (error de red, etc), quitamos el loading para que puedas volver a probar
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-red-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
            {/* Fondo con ruido/efecto */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-50 pointer-events-none"></div>

            <div className="relative z-10 max-w-md w-full">
                <div className="flex justify-center mb-6">
                    <div className="bg-black/50 p-6 rounded-full border-4 border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-pulse">
                        <Skull size={64} className="text-red-500" />
                    </div>
                </div>

                <h1 className="text-5xl font-black text-white mb-2 tracking-tighter uppercase">Game Over</h1>
                <p className="text-red-300 font-bold tracking-widest uppercase mb-8 text-sm">Tu salud ha llegado a cero</p>

                <div className="bg-black/80 border-2 border-red-600/50 p-6 rounded-2xl mb-8 shadow-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-center gap-2 text-red-500 mb-4">
                        <Lock size={20} />
                        <span className="font-bold text-xs uppercase">Misión de Desbloqueo</span>
                    </div>

                    <p className="text-2xl font-black text-white italic leading-tight">
                        "{user.redemptionMission || "Misión de emergencia: Haz 50 burpees"}"
                    </p>
                </div>

                <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                    Solo podrás volver a acceder a la aplicación cuando hayas completado tu castigo. Sé honesto contigo mismo.
                </p>

                <button
                    onClick={handleRevive}
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    {loading ? (
                        <>
                            <RefreshCcw className="animate-spin" /> REINICIANDO SISTEMA...
                        </>
                    ) : (
                        <>
                            <CheckCircle size={24} />
                            HE CUMPLIDO MI MISIÓN
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}