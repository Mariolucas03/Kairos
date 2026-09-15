import { useRef, useState, useEffect } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';

/**
 * LEVANTA LA BARRA PARA ENTRAR.
 *
 * En vez de un botón, una barra de pesas: la agarras por el disco y la
 * arrastras hasta el final. Al completar el recorrido se entra. Es el gesto
 * de la app —levantar— hecho puerta, y de paso evita el toque accidental que
 * cualquier botón se come.
 *
 * Sigue siendo un formulario normal por debajo: la tecla Enter en los campos
 * entra igual, y con teclado la barra se "levanta" con Espacio o Enter. Nadie
 * se queda fuera por no poder arrastrar.
 *
 * `onCompletar` se llama UNA vez al llegar al final; mientras `cargando`, la
 * barra se queda arriba con el disco girando.
 */
export default function BarraDeAcceso({ acento = '#eab308', etiqueta = 'Levanta para entrar', textoCargando = 'Levantando…', cargando = false, deshabilitado = false, onCompletar }) {
    const pista = useRef(null);
    const [avance, setAvance] = useState(0);          // 0..1
    const [arrastrando, setArrastrando] = useState(false);
    const completada = useRef(false);
    const DISCO = 56;

    // Al terminar de cargar (con error), la barra vuelve al principio.
    useEffect(() => {
        if (!cargando) { completada.current = false; setAvance(0); }
    }, [cargando]);

    const recorrido = () => Math.max(1, (pista.current?.clientWidth || 300) - DISCO - 8);

    const completar = () => {
        if (completada.current || cargando || deshabilitado) return;
        completada.current = true;
        setAvance(1);
        // Si quien recibe la barra dice que no (faltan datos), vuelve abajo.
        const r = onCompletar?.();
        if (r === false) { completada.current = false; setAvance(0); }
    };

    const alBajar = (e) => {
        if (cargando || deshabilitado) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setArrastrando(true);
        pista.current.dataset.x0 = String(e.clientX - avance * recorrido());
    };
    const alMover = (e) => {
        if (!arrastrando || cargando) return;
        const x0 = Number(pista.current.dataset.x0 || 0);
        const p = Math.max(0, Math.min(1, (e.clientX - x0) / recorrido()));
        setAvance(p);
        if (p >= 0.94) { setArrastrando(false); completar(); }
    };
    const alSoltar = () => {
        if (!arrastrando) return;
        setArrastrando(false);
        if (!completada.current) setAvance(0);
    };

    const x = avance * recorrido();
    const listo = cargando || avance >= 1;

    return (
        <div className="mt-6 select-none">
            <div
                ref={pista}
                role="button"
                tabIndex={0}
                aria-label={etiqueta}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); completar(); } }}
                className="relative h-16 rounded-2xl border overflow-hidden outline-none focus-visible:ring-2 textura-carbono"
                style={{ borderColor: acento + '55', touchAction: 'none', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05)' }}
            >
                {/* Lo recorrido se enciende */}
                <div
                    className="absolute inset-y-0 left-0 rounded-2xl"
                    style={{ width: x + DISCO + 4, background: `linear-gradient(90deg, ${acento}22, ${acento}55)`, transition: arrastrando ? 'none' : 'width 320ms cubic-bezier(0.22, 0.85, 0.24, 1)' }}
                />

                {/* La barra: la varilla y los topes, detras del disco */}
                <div className="absolute inset-y-0 left-3 right-3 flex items-center pointer-events-none">
                    <div className="w-full h-[6px] rounded-full" style={{ background: 'linear-gradient(90deg, #52525b, #a1a1aa 50%, #52525b)', boxShadow: '0 1px 2px rgba(0,0,0,0.8)' }} />
                    <div className="absolute right-0 w-[10px] h-7 rounded-sm" style={{ background: 'linear-gradient(180deg, #a1a1aa, #3f3f46)' }} />
                </div>

                {/* La etiqueta, que se apaga segun avanzas */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: listo ? 1 : 1 - avance * 1.6 }}>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 not-italic flex items-center gap-1 pl-10 bg-[#0a0a0c]/85 px-2 py-1 rounded-md">
                        {cargando ? textoCargando : listo ? '' : etiqueta}
                        {!listo && <ChevronRight size={14} className="animate-pulse" />}
                    </span>
                </div>

                {/* EL DISCO: lo que se agarra */}
                <div
                    onPointerDown={alBajar}
                    onPointerMove={alMover}
                    onPointerUp={alSoltar}
                    onPointerCancel={alSoltar}
                    className="absolute top-1 left-1 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                    style={{
                        width: DISCO, height: DISCO,
                        transform: `translateX(${x}px)`,
                        transition: arrastrando ? 'none' : 'transform 320ms cubic-bezier(0.22, 0.85, 0.24, 1)',
                        background: `radial-gradient(circle at 35% 30%, ${acento}, ${acento}aa 60%, #000 100%)`,
                        boxShadow: `0 4px 14px rgba(0,0,0,0.7), 0 0 ${12 + avance * 30}px ${acento}${listo ? '99' : '55'}`
                    }}
                >
                    {/* El agujero del disco */}
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#0a0a0c', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.9)' }}>
                        {cargando && <Loader2 size={12} className="animate-spin text-white" />}
                    </div>
                </div>
            </div>
        </div>
    );
}
