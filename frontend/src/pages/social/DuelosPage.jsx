import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { Swords, Loader2, Plus, Flag, Check, X, Trophy, Handshake } from 'lucide-react';

import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import SocialSubHeader from '../../components/social/SocialSubHeader';
import SelectorApuesta from '../../components/games/SelectorApuesta';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const fetcher = (url) => api.get(url).then(res => res.data);

/**
 * DUELOS.
 *
 * ⚠️ ESTA PANTALLA DECÍA "PRÓXIMAMENTE" Y NO MENTÍA.
 *
 * El servidor tenía media función desde hacía tiempo: se podía retar y aceptar,
 * y ahí se acababa todo. Nada ponía ganador, nada ponía fecha de fin y la
 * apuesta no se cobraba nunca. Deslizar en un amigo sacaba un aviso de "en
 * construcción" porque no había nada que enseñar.
 *
 * Un duelo es una semana midiendo una cosa: kilos movidos, entrenos, XP o
 * misiones. Los dos ponen la misma apuesta al aceptar y el que más haga se
 * lleva el bote. Qué se puede medir lo dice el servidor —ver MEDIDAS en
 * services/duelosService.js—, y esta pantalla solo pinta lo que le manden.
 *
 * ⚠️ LA DURACIÓN NO ESTÁ ESCRITA AQUÍ.
 *
 * Viene del servidor (`duracionDias`) porque es él quien la aplica. Escribir el
 * 7 a mano en esta pantalla sería tener la regla en dos sitios, y el día que
 * cambie allí esto seguiría prometiendo una semana. Es el fallo que más veces
 * ha salido en este proyecto.
 */

/**
 * El número con su unidad: "12.400 kg", "5 entrenos", "1.200 XP".
 *
 * La unidad la manda el servidor con cada duelo, para que añadir un tipo nuevo
 * no obligue a tocar esta pantalla.
 */
const conUnidad = (n, unidad = '') =>
    `${Math.round(n || 0).toLocaleString('es-ES')}${unidad ? ' ' + unidad : ''}`;

/** "3 días", "1 día", "hoy". Lo que queda para que se cierre. */
const loQueQueda = (fin) => {
    const ms = new Date(fin).getTime() - Date.now();
    if (ms <= 0) return 'se cierra esta noche';
    const dias = Math.ceil(ms / 86400000);
    return dias === 1 ? 'queda 1 día' : `quedan ${dias} días`;
};

/** Con quién es el duelo, mirándolo desde tus ojos. */
const elOtro = (duelo, miId) =>
    duelo.challenger?._id === miId ? duelo.opponent : duelo.challenger;

const Avatar = ({ persona, size = 36 }) => (
    <div
        className="rounded-full bg-zinc-900 border border-white/[0.07] flex items-center justify-center text-[11px] font-black text-zinc-500 overflow-hidden shrink-0"
        style={{ width: size, height: size }}
    >
        {persona?.avatar
            ? <img src={persona.avatar} alt="" className="w-full h-full object-cover" />
            : (persona?.username?.charAt(0)?.toUpperCase() || '?')}
    </div>
);

const Seccion = ({ titulo, color, children }) => (
    <div className="mb-6">
        <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2.5 ml-1 ${color}`}>
            {titulo}
        </h2>
        <div className="space-y-2">{children}</div>
    </div>
);

const Tarjeta = ({ children, borde = 'border-white/[0.07]' }) => (
    <div className={`bg-[#0a0a0c] border ${borde} rounded-2xl p-3.5`}>{children}</div>
);

/**
 * CÓMO VA EL DUELO AHORA MISMO.
 *
 * ⚠️ ESTO ES LO QUE LE FALTABA A LOS DUELOS.
 *
 * Sin marcador, aceptar un duelo era empezar siete días de silencio: no sabías
 * nada hasta la última noche. Lo que hace que vuelvas al gimnasio es abrir la
 * app y ver que vas dos mil kilos por detrás y que quedan tres días.
 *
 * Los números vienen del SERVIDOR, calculados con la misma función que reparte
 * el bote al cerrar. Sumarlos aquí daría un marcador distinto del que decide
 * quién gana, y entonces estarías mirando un duelo que no es el tuyo.
 */
const Marcador = ({ mio, suyo, unidad, rival }) => {
    const total = mio + suyo;
    // Sin datos todavía, la barra se queda a la mitad: un 0-0 no lo gana nadie.
    const miParte = total > 0 ? (mio / total) * 100 : 50;
    const voyGanando = mio > suyo;
    const empate = mio === suyo;

    return (
        <div className="mt-3">
            <div className="flex items-end justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                    <p className={`text-[17px] font-black tabular-nums leading-none not-italic ${voyGanando ? 'text-yellow-500' : 'text-zinc-300'}`}>
                        {conUnidad(mio, unidad)}
                    </p>
                    <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-1">Tú</p>
                </div>
                <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest pb-3 shrink-0">vs</span>
                <div className="min-w-0 flex-1 text-right">
                    <p className={`text-[17px] font-black tabular-nums leading-none not-italic ${!voyGanando && !empate ? 'text-yellow-500' : 'text-zinc-300'}`}>
                        {conUnidad(suyo, unidad)}
                    </p>
                    <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-1 truncate">
                        {rival?.username}
                    </p>
                </div>
            </div>

            {/* La barra: tu parte del total. De un vistazo se ve por cuánto vas. */}
            <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden flex">
                <div
                    className="h-full transition-all duration-500"
                    style={{
                        width: `${miParte}%`,
                        background: voyGanando ? '#eab308' : '#3f3f46'
                    }}
                />
                <div
                    className="h-full flex-1 transition-all duration-500"
                    style={{ background: !voyGanando && !empate ? '#eab308' : '#27272a' }}
                />
            </div>

            <p className={`text-[10px] font-black uppercase tracking-widest mt-2 text-center not-italic ${empate ? 'text-zinc-500' : voyGanando ? 'text-yellow-500' : 'text-red-400'}`}>
                {empate
                    ? (total === 0 ? 'Nadie ha empezado' : 'Empate')
                    : voyGanando
                        ? `Ganas por ${conUnidad(mio - suyo, unidad)}`
                        : `Pierdes por ${conUnidad(suyo - mio, unidad)}`}
            </p>
        </div>
    );
};


const Boton = ({ children, onClick, tono = 'neutro', disabled }) => {
    const tonos = {
        si: 'bg-yellow-500 text-black border-yellow-700',
        no: 'bg-zinc-900 text-zinc-400 border-white/[0.07]',
        peligro: 'bg-red-900/20 text-red-400 border-red-900/40',
        neutro: 'bg-zinc-900 text-zinc-300 border-white/[0.07]'
    };
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex-1 py-2 rounded-xl border-b-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40 ${tonos[tono]}`}
        >
            {children}
        </button>
    );
};

export default function DuelosPage() {
    const [params] = useSearchParams();
    const user = useAuthStore(s => s.user);
    const setUser = useAuthStore(s => s.setUser);
    const miId = user?._id;

    const { data, mutate, isLoading } = useSWR('/challenges', fetcher, { revalidateOnFocus: true });
    const { data: amigosData } = useSWR('/social/friends', fetcher);

    const [toast, setToast] = useState(null);
    const [confirmar, setConfirmar] = useState(null);
    const [enVuelo, setEnVuelo] = useState(false);

    // Se llega aquí desde la lista de amigos deslizando sobre alguien, y en ese
    // caso la ventana se abre sola con esa persona la primera de la lista. Sin
    // eso, deslizar sobre un amigo concreto te dejaría buscándolo otra vez.
    const rivalSugerido = params.get('rival');
    const [creando, setCreando] = useState(() => Boolean(rivalSugerido));
    const [apuesta, setApuesta] = useState(50);
    // 'gym' de partida porque es una app de gimnasio. Las claves las manda el
    // servidor, asi que si algun dia se añade un tipo aparece aqui solo.
    const [tipo, setTipo] = useState('gym');

    // Memorizado porque de el cuelgan dos useMemo: con un array nuevo en
    // cada pintado, los dos se recalculaban siempre y no servian de nada.
    const duelos = useMemo(() => data?.duelos || [], [data]);
    const dias = data?.duracionDias;
    const medidas = useMemo(() => data?.medidas || [], [data]);
    // Los duelos terminados no traen marcador —sus numeros ya estan guardados—,
    // asi que la unidad se busca por tipo en el catalogo del servidor.
    const unidadDe = useMemo(() => {
        const porClave = Object.fromEntries(medidas.map(m => [m.clave, m.unidad]));
        return (tipo) => porClave[tipo] || '';
    }, [medidas]);
    // El sugerido primero: es a quien venias a retar.
    const amigos = useMemo(() => {
        const lista = amigosData?.friends || [];
        if (!rivalSugerido) return lista;
        return [...lista].sort((a, b) =>
            (b._id === rivalSugerido) - (a._id === rivalSugerido));
    }, [amigosData, rivalSugerido]);

    const { retadoPorMi, meHanRetado, activos, terminados } = useMemo(() => {
        const g = { retadoPorMi: [], meHanRetado: [], activos: [], terminados: [] };
        for (const d of duelos) {
            if (d.status === 'active') g.activos.push(d);
            else if (d.status === 'finished') g.terminados.push(d);
            else if (d.challenger?._id === miId) g.retadoPorMi.push(d);
            else g.meHanRetado.push(d);
        }
        return g;
    }, [duelos, miId]);

    // Con quién NO se puede abrir otro: el servidor solo permite uno por pareja.
    const ocupados = useMemo(
        () => new Set(duelos
            .filter(d => d.status === 'pending' || d.status === 'active')
            .map(d => elOtro(d, miId)?._id)),
        [duelos, miId]
    );

    /**
     * Todo lo que cambia un duelo pasa por aquí.
     *
     * Sin pintado optimista a propósito: aquí se mueven FICHAS. Enseñar el
     * resultado antes de que el servidor conteste y tener que deshacerlo
     * después sería enseñar un saldo que no es el tuyo.
     */
    const pedir = async (fn, exito) => {
        if (enVuelo) return false;
        setEnVuelo(true);
        try {
            const res = await fn();
            await mutate();
            // El servidor devuelve el usuario ya actualizado cuando la acción
            // mueve fichas. Restar la apuesta aquí sería tener la misma cuenta
            // en dos sitios, y con que el servidor rechazara el cobro la
            // cabecera enseñaría un saldo que no es el tuyo.
            if (res?.data?.user) setUser(res.data.user);
            setToast({ message: exito, type: 'success' });
            return true;
        } catch (e) {
            setToast({
                message: e?.response?.data?.message || 'No se ha podido. Inténtalo otra vez.',
                type: 'error'
            });
            // ⚠️ SE DEVUELVE SI SALIO BIEN, Y NO ES UN DETALLE.
            //
            // Antes esto no devolvia nada y el que llamaba encadenaba un
            // `.then()`: como los fallos se recogen AQUI, la promesa se resolvia
            // igual y la ventana de "nuevo duelo" se cerraba tambien cuando el
            // servidor decia que no. Veias el error y a la vez perdias el tipo y
            // la apuesta que acababas de elegir.
            return false;
        } finally {
            setEnVuelo(false);
        }
    };

    const retar = async (rivalId) => {
        const salioBien = await pedir(
            () => api.post('/challenges', { opponentId: rivalId, type: tipo, betAmount: apuesta }),
            'Duelo enviado. A ver si se atreve.'
        );
        // Solo se cierra si de verdad se ha creado. Si el servidor rechaza —sin
        // fichas, ya teneis uno, ya no sois amigos— la ventana se queda con lo
        // que habias elegido para poder cambiar lo que sea y reintentar.
        if (salioBien) setCreando(false);
    };

    const responder = (id, action, exito) => pedir(
        () => api.post('/challenges/respond', { challengeId: id, action }),
        exito
    );

    // Igual que en los juegos: segun de donde venga la respuesta, el saldo
    // esta en la raiz o dentro de `stats`. Se miran los dos.
    const saldo = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;

    return (
        <div className="pt-safe-page pb-28">
            <SocialSubHeader
                title="Duelos"
                subtitle={dias ? `${dias} días, el que más gane` : 'Uno contra uno'}
                icon={Swords}
                right={
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/[0.07] rounded-xl px-2.5 py-1.5 shrink-0">
                        <img src="/assets/icons/ficha.png" alt="" className="w-4 h-4 object-contain" />
                        <span className="text-[13px] font-black text-yellow-500 tabular-nums">{saldo}</span>
                    </div>
                }
            />

            {isLoading && (
                <div className="flex justify-center py-16 text-zinc-600">
                    <Loader2 size={22} className="animate-spin" />
                </div>
            )}

            {!isLoading && (
                <>
                    <button
                        type="button"
                        onClick={() => setCreando(true)}
                        className="w-full mb-6 bg-yellow-500 text-black font-black py-3.5 rounded-2xl uppercase tracking-widest text-[12px] flex items-center justify-center gap-2 border-b-4 border-yellow-700 active:scale-95 transition-transform"
                    >
                        <Plus size={16} /> Retar a un amigo
                    </button>

                    {meHanRetado.length > 0 && (
                        <Seccion titulo="Te han retado" color="text-yellow-500">
                            {meHanRetado.map(d => (
                                <Tarjeta key={d._id} borde="border-yellow-500/25">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Avatar persona={d.challenger} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-black text-white uppercase truncate not-italic">
                                                {d.challenger?.username}
                                            </p>
                                            <p className="text-[10px] text-zinc-500">
                                                {/* A QUE te reta importa tanto como cuanto: uno
                                                    de kilos y uno de misiones no se aceptan
                                                    igual segun como andes de tiempo. */}
                                                {medidas.find(m => m.clave === d.type)?.etiqueta || 'Kilos movidos'}
                                                {' · '}
                                                <span className="text-yellow-500 font-black">{d.betAmount}</span> fichas
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Boton tono="si" disabled={enVuelo}
                                            onClick={() => responder(d._id, 'accept', '¡Duelo aceptado! A entrenar.')}>
                                            <Check size={12} /> Aceptar
                                        </Boton>
                                        <Boton tono="no" disabled={enVuelo}
                                            onClick={() => responder(d._id, 'reject', 'Duelo rechazado')}>
                                            <X size={12} /> Paso
                                        </Boton>
                                    </div>
                                    <p className="text-[9px] text-zinc-600 mt-2.5 text-center leading-snug">
                                        Al aceptar se os cobra la apuesta a los dos y arrancan los {dias} días.
                                    </p>
                                </Tarjeta>
                            ))}
                        </Seccion>
                    )}

                    {activos.length > 0 && (
                        <Seccion titulo="En marcha" color="text-emerald-500">
                            {activos.map(d => {
                                const rival = elOtro(d, miId);
                                const soyRetador = d.challenger?._id === miId;
                                return (
                                    <Tarjeta key={d._id} borde="border-emerald-500/25">
                                        <div className="flex items-center gap-3">
                                            <Avatar persona={rival} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-black text-white uppercase truncate not-italic">
                                                    contra {rival?.username}
                                                </p>
                                                <p className="text-[10px] text-zinc-500">
                                                    {d.marcador?.etiqueta || 'Kilos movidos'} · {loQueQueda(d.endDate)} · bote de{' '}
                                                    <span className="text-yellow-500 font-black">{d.betAmount * 2}</span>
                                                </p>
                                            </div>
                                        </div>
                                        {d.marcador && (
                                            <Marcador
                                                mio={soyRetador ? d.marcador.retador : d.marcador.rival}
                                                suyo={soyRetador ? d.marcador.rival : d.marcador.retador}
                                                unidad={d.marcador.unidad}
                                                rival={rival}
                                            />
                                        )}
                                        <div className="h-2.5" />
                                        {/* En un contenedor flex porque `Boton` reparte el
                                            ancho con `flex-1`, y suelto se quedaba en una
                                            pastilla estrecha pegada a la izquierda. */}
                                        <div className="flex">
                                            <Boton tono="peligro" disabled={enVuelo}
                                                onClick={() => setConfirmar({
                                                    message: `¿Rendirte contra ${rival?.username}? Pierdes tus ${d.betAmount} fichas y el bote entero es para él.`,
                                                    onConfirm: () => responder(d._id, 'flee', 'Te has rendido')
                                                })}>
                                                <Flag size={12} /> Rendirse
                                            </Boton>
                                        </div>
                                    </Tarjeta>
                                );
                            })}
                        </Seccion>
                    )}

                    {retadoPorMi.length > 0 && (
                        <Seccion titulo="Esperando respuesta" color="text-zinc-500">
                            {retadoPorMi.map(d => (
                                <Tarjeta key={d._id}>
                                    <div className="flex items-center gap-3">
                                        <Avatar persona={d.opponent} size={32} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-black text-zinc-300 uppercase truncate not-italic">
                                                {d.opponent?.username}
                                            </p>
                                            <p className="text-[10px] text-zinc-600">
                                                {d.betAmount} fichas · aún no ha contestado
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={enVuelo}
                                            onClick={() => responder(d._id, 'flee', 'Reto retirado')}
                                            aria-label="Retirar el reto"
                                            className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/[0.07] text-zinc-500 flex items-center justify-center active:scale-90 transition-transform shrink-0"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </Tarjeta>
                            ))}
                        </Seccion>
                    )}

                    {terminados.length > 0 && (
                        <Seccion titulo="Terminados" color="text-zinc-600">
                            {terminados.map(d => {
                                const rival = elOtro(d, miId);
                                const soyRetador = d.challenger?._id === miId;
                                const mios = soyRetador ? d.volumenChallenger : d.volumenOpponent;
                                const suyos = soyRetador ? d.volumenOpponent : d.volumenChallenger;
                                const empate = !d.winner;
                                const gane = d.winner === miId;

                                return (
                                    <Tarjeta key={d._id} borde={gane ? 'border-yellow-500/25' : 'border-white/[0.07]'}>
                                        <div className="flex items-center gap-3">
                                            {empate
                                                ? <Handshake size={16} className="text-zinc-500 shrink-0" />
                                                : <Trophy size={16} className={gane ? 'text-yellow-500 shrink-0' : 'text-zinc-700 shrink-0'} />}
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-[12px] font-black uppercase truncate not-italic ${gane ? 'text-yellow-500' : 'text-zinc-400'}`}>
                                                    {empate ? 'Empate' : gane ? 'Ganaste' : 'Perdiste'}
                                                    <span className="text-zinc-600"> contra {rival?.username}</span>
                                                </p>
                                                <p className="text-[10px] text-zinc-500 tabular-nums">
                                                    {conUnidad(mios, unidadDe(d.type))} contra {conUnidad(suyos, unidadDe(d.type))}
                                                </p>
                                            </div>
                                            <span className={`text-[12px] font-black tabular-nums shrink-0 ${gane ? 'text-yellow-500' : 'text-zinc-600'}`}>
                                                {empate ? '±0' : gane ? `+${d.betAmount}` : `−${d.betAmount}`}
                                            </span>
                                        </div>
                                    </Tarjeta>
                                );
                            })}
                        </Seccion>
                    )}

                    {duelos.length === 0 && (
                        <div className="text-center py-14 px-8 border-2 border-dashed border-zinc-900 rounded-3xl">
                            <Swords className="mx-auto mb-3 text-zinc-700" size={30} />
                            <p className="text-[12px] text-zinc-500 font-bold leading-snug">
                                Aún no has retado a nadie.
                            </p>
                            <p className="text-[10px] text-zinc-600 mt-1.5 leading-snug">
                                Gana quien más kilos mueva en {dias} días.
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* --- ELEGIR RIVAL Y APUESTA --- */}
            {creando && (
                <div
                    className="fixed inset-0 z-[8000] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                    onClick={() => setCreando(false)}
                >
                    <div
                        className="w-full max-w-md bg-[#0a0a0c] border border-white/[0.07] rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[14px] font-black text-white uppercase tracking-tight not-italic">
                                Nuevo duelo
                            </h3>
                            <button
                                type="button"
                                onClick={() => setCreando(false)}
                                aria-label="Cerrar"
                                className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/[0.07] text-zinc-400 flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* ⚠️ QUE SE MIDE, PRIMERO.
                            Es la decision que cambia el duelo entero: uno de kilos
                            y uno de misiones no se parecen en nada. La apuesta va
                            despues porque es el detalle. */}
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">
                            ¿A qué jugáis?
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 mb-4">
                            {medidas.map(m => {
                                const elegido = tipo === m.clave;
                                return (
                                    <button
                                        key={m.clave}
                                        type="button"
                                        onClick={() => setTipo(m.clave)}
                                        className={`p-2.5 rounded-2xl border text-left transition-colors ${elegido
                                            ? 'bg-yellow-500/[0.08] border-yellow-500/40'
                                            : 'bg-zinc-900 border-white/[0.07]'}`}
                                    >
                                        <span className={`block text-[11px] font-black uppercase tracking-tight not-italic ${elegido ? 'text-yellow-500' : 'text-zinc-300'}`}>
                                            {m.etiqueta}
                                        </span>
                                        <span className="block text-[9px] text-zinc-600 leading-tight mt-0.5">
                                            {m.pista}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <SelectorApuesta
                            valor={apuesta}
                            onChange={setApuesta}
                            saldo={saldo}
                            maximo={saldo}
                            etiqueta="Ponéis cada uno"
                        />

                        <p className="text-[10px] text-zinc-500 mt-3 mb-4 leading-snug">
                            {dias} días. El bote son{' '}
                            <span className="text-yellow-500 font-black">{apuesta * 2}</span> fichas
                            y se cobra cuando acepte.
                        </p>

                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">
                            ¿Contra quién?
                        </p>

                        {amigos.length === 0 ? (
                            <p className="text-[11px] text-zinc-600 py-6 text-center leading-snug">
                                Los duelos son entre amigos.<br />Añade a alguien primero.
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {amigos.map(a => {
                                    const yaTiene = ocupados.has(a._id);
                                    return (
                                        <button
                                            key={a._id}
                                            type="button"
                                            disabled={yaTiene || enVuelo || apuesta > saldo}
                                            onClick={() => retar(a._id)}
                                            className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-900 border border-white/[0.07] text-left active:scale-[0.98] transition-transform disabled:opacity-35"
                                        >
                                            <Avatar persona={a} size={32} />
                                            <span className="flex-1 min-w-0 text-[12px] font-black text-white uppercase truncate not-italic">
                                                {a.username}
                                            </span>
                                            {yaTiene && (
                                                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-wider shrink-0">
                                                    ya tenéis uno
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {confirmar && (
                <ConfirmDialog
                    message={confirmar.message}
                    onCancel={() => setConfirmar(null)}
                    onConfirm={() => { confirmar.onConfirm(); setConfirmar(null); }}
                />
            )}

            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
        </div>
    );
}
