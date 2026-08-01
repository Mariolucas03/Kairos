/**
 * Gráfica de progreso de un ejercicio.
 *
 * SVG a mano en vez de recharts: la librería pesa ~300 KB y aquí solo hace falta
 * una línea con puntos, así que no merece la pena cargarla en el bundle del gym.
 */
export default function ProgressChart({ points = [], metric = 'bestWeight', color = '#eab308', unit = 'kg' }) {
    if (points.length < 2) {
        return (
            <div className="h-40 flex items-center justify-center text-center px-6">
                <p className="text-[11px] text-zinc-600 font-bold leading-tight">
                    Necesitas al menos dos sesiones de este ejercicio para ver la evolución.
                </p>
            </div>
        );
    }

    const W = 320, H = 150, PAD = { top: 14, right: 10, bottom: 22, left: 34 };
    const valores = points.map(p => p[metric] || 0);
    const max = Math.max(...valores);
    const min = Math.min(...valores);
    // Un poco de margen arriba y abajo para que la línea no toque los bordes
    const techo = max === min ? max + 1 : max + (max - min) * 0.15;
    const suelo = max === min ? Math.max(0, max - 1) : Math.max(0, min - (max - min) * 0.15);

    const x = (i) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v) => PAD.top + (1 - (v - suelo) / (techo - suelo)) * (H - PAD.top - PAD.bottom);

    const linea = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const area = `${linea}L${x(valores.length - 1).toFixed(1)},${H - PAD.bottom}L${x(0).toFixed(1)},${H - PAD.bottom}Z`;

    const fecha = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const ultimo = valores[valores.length - 1];
    const primero = valores[0];
    const dif = ultimo - primero;

    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Rejilla y escala */}
                {[0, 0.5, 1].map(t => {
                    const v = suelo + (techo - suelo) * (1 - t);
                    const yy = PAD.top + t * (H - PAD.top - PAD.bottom);
                    return (
                        <g key={t}>
                            <line x1={PAD.left} y1={yy} x2={W - PAD.right} y2={yy} stroke="#27272a" strokeWidth="1" strokeDasharray="3 3" />
                            <text x={PAD.left - 5} y={yy + 3} textAnchor="end" fill="#52525b" fontSize="8" fontWeight="bold">
                                {Math.round(v)}
                            </text>
                        </g>
                    );
                })}

                <path d={area} fill={`url(#grad-${metric})`} />
                <path d={linea} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

                {valores.map((v, i) => (
                    <circle key={i} cx={x(i)} cy={y(v)} r={i === valores.length - 1 ? 3.5 : 2} fill={color}>
                        <title>{fecha(points[i].date)}: {v} {unit}</title>
                    </circle>
                ))}

                {/* Primera y última fecha */}
                <text x={PAD.left} y={H - 6} fill="#52525b" fontSize="8" fontWeight="bold">{fecha(points[0].date)}</text>
                <text x={W - PAD.right} y={H - 6} textAnchor="end" fill="#52525b" fontSize="8" fontWeight="bold">
                    {fecha(points[points.length - 1].date)}
                </text>
            </svg>

            <div className="flex items-center justify-center gap-4 mt-1">
                <span className="text-[10px] font-bold text-zinc-500">
                    Ahora <span className="text-white font-black">{ultimo} {unit}</span>
                </span>
                <span className={`text-[10px] font-black ${dif > 0 ? 'text-green-400' : dif < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                    {dif > 0 ? '+' : ''}{Math.round(dif * 10) / 10} {unit} desde el principio
                </span>
            </div>
        </div>
    );
}
