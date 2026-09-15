import { useEffect, useState } from 'react';
import BodyMap from '../body/BodyMap';
import MarcoPerfil from '../common/MarcoPerfil';

/**
 * EL ESCÁNER BIOMÉTRICO: el fondo y el avatar de las pantallas de acceso.
 *
 * La pantalla de entrar es el panel de control del gimnasio, no un
 * formulario sobre una foto. Tres piezas:
 *
 *  1. LA PROYECCIÓN: los dos diagramas musculares (frente y espalda) en una
 *     pantalla de vidrio al fondo, con un barrido de luz que los recorre.
 *     Son "el después": el cuerpo de referencia.
 *  2. EL AVATAR EN CONSTRUCCIÓN, junto al formulario: una figura pequeña que
 *     se va encendiendo por zonas según rellenas (nombre, cuerpo, llave...).
 *     Si el nombre es de alguien que ya existe, se convierte en SU avatar,
 *     con su marco y su nivel: el panel te reconoce antes de la contraseña.
 *  3. EL PULSO: cada vez que entras en un campo, la proyección da un latido
 *     de luz, como si estuviera comprobando tus datos.
 */

// Que zonas se encienden segun lo construido (0..1): de dentro hacia fuera
const ZONAS_POR_ORDEN = ['Abdomen', 'Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Antebrazo', 'Pierna'];

export function Proyeccion({ acento, pulso = 0, icono: Icono = null }) {
    // Un latido por cada cambio de `pulso` (cuenta que sube al enfocar un campo)
    const [latiendo, setLatiendo] = useState(false);
    useEffect(() => {
        if (!pulso) return;
        setLatiendo(true);
        const t = setTimeout(() => setLatiendo(false), 700);
        return () => clearTimeout(t);
    }, [pulso]);

    return (
        <div className="w-full flex justify-center pointer-events-none" aria-hidden="true">
            <div
                className={`relative w-full h-[168px] rounded-[1.6rem] border overflow-hidden transition-all duration-500 ${latiendo ? 'auth-latido' : ''}`}
                style={{
                    borderColor: acento + '33',
                    background: `linear-gradient(180deg, ${acento}0d 0%, rgba(255,255,255,0.02) 40%, rgba(0,0,0,0) 100%)`,
                    boxShadow: `inset 0 0 40px ${acento}14, 0 0 60px ${acento}${latiendo ? '55' : '22'}`,
                    opacity: latiendo ? 1 : 0.8
                }}
            >
                {Icono && (
                    <span className="absolute top-2.5 left-3 w-7 h-7 rounded-lg flex items-center justify-center border" style={{ borderColor: acento + '55', background: acento + '1a' }}>
                        <Icono size={15} style={{ color: acento }} />
                    </span>
                )}
                {/* Las lineas del vidrio */}
                <div className="absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent 0 3px, ${acento}0a 3px 4px)` }} />
                <div className="absolute inset-x-8 top-3 bottom-6 opacity-60">
                    <BodyMap dual showToggle={false} labels highlight={[]} accent={acento} className="h-full" />
                </div>
                {/* El barrido de luz que recorre el diagrama */}
                <div className="auth-barrido absolute inset-x-0 h-16 pointer-events-none" style={{ background: `linear-gradient(180deg, transparent, ${acento}33, transparent)` }} />
                <p className="absolute bottom-2 inset-x-0 text-center text-[8px] font-black uppercase tracking-[0.4em] not-italic" style={{ color: acento + 'aa' }}>
                    Referencia biométrica
                </p>
            </div>
        </div>
    );
}

export function AvatarEnConstruccion({ acento, construido = 0, mujer = null, vistazo = null, nombre = '', etiqueta }) {
    const cuantas = Math.round(Math.max(0, Math.min(1, construido)) * ZONAS_POR_ORDEN.length);
    const encendidas = ZONAS_POR_ORDEN.slice(0, cuantas);
    const pct = Math.round(Math.max(0, Math.min(1, construido)) * 100);

    return (
        <div className="flex items-center gap-3 mb-5 rounded-2xl border px-3 py-2.5" style={{ borderColor: acento + '33', background: 'rgba(0,0,0,0.35)' }}>
            <div className="relative shrink-0 w-14 h-16">
                {vistazo ? (
                    <div className="relative w-14 h-14 mt-1">
                        <div className="w-14 h-14 rounded-full bg-zinc-900 border border-white/10 overflow-hidden flex items-center justify-center text-lg font-black text-zinc-500">
                            {vistazo.avatar ? <img src={vistazo.avatar} alt="" className="w-full h-full object-cover" /> : (vistazo.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <MarcoPerfil marco={vistazo.frame} tamano={68} desborde={7} />
                    </div>
                ) : (
                    <BodyMap showToggle={false} labels={false} mujer={mujer === 'female'} highlight={encendidas} accent={acento} className="h-full" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                {vistazo ? (
                    <>
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] not-italic" style={{ color: acento }}>Identificado</p>
                        <p className="text-sm font-black text-white uppercase truncate not-italic">{vistazo.username}</p>
                        <p className="text-[10px] text-zinc-400 font-bold not-italic truncate">Nivel {vistazo.level}{vistazo.title ? ` · ${vistazo.title}` : ''}</p>
                    </>
                ) : (
                    <>
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] not-italic" style={{ color: acento }}>{etiqueta || 'Escaneando'}</p>
                        <p className="text-sm font-black text-white uppercase truncate not-italic">{nombre || 'Sin identificar'}</p>
                        <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: acento }} />
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold mt-1 tabular-nums not-italic">Perfil construido al {pct}%</p>
                    </>
                )}
            </div>
        </div>
    );
}
