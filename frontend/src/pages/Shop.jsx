import { useState, useEffect } from 'react';
import useSWR from 'swr';
// 🔥 QUITAMOS useOutletContext
// import { useOutletContext } from 'react-router-dom';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../store/useAuthStore';
import {
    Plus, X, ArrowRightLeft,
    Ticket, Heart, User, ScanFace, Palette, Package, PawPrint, Crown,
    ShoppingBag, Backpack, Save, Loader2
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';
import ChestModal from '../components/common/ChestModal';
import BackButton from '../components/common/BackButton';

const fetcher = (url) => api.get(url).then(res => res.data);

/**
 * Rareza: UN tono por tier, igual que el resto de la app.
 *
 * Antes cada rareza traía borde de color, sombra exterior encendida y un halo
 * al 20%: cuatro niveles compitiendo y la cuadrícula entera vibrando. Ahora el
 * color va donde va en todo Kairos —la línea de acento de 2px y la etiqueta— y
 * la tarjeta es la misma superficie que las del Home, el Arcade y Misiones.
 *
 * `shadow-[0_0_15px_...]` además nunca llegó a existir: son clases con valor
 * arbitrario que Tailwind sí genera, pero el brillo quedaba tapado por el
 * `overflow-hidden` de la propia tarjeta.
 */
// Las dos monedas del juego, cada una con su tono: monedas amarillas, fichas
// moradas. Es el mismo par que usa la cabecera de la app.
const ACENTO_TIENDA = '#eab308';
const ACENTO_FICHAS = '#a855f7';

const RARITIES = {
    comun: { label: 'Común', accent: '#71717a', text: 'text-zinc-500' },
    raro: { label: 'Raro', accent: '#3b82f6', text: 'text-blue-400' },
    epico: { label: 'Épico', accent: '#a855f7', text: 'text-purple-400' },
    legendario: { label: 'Legendario', accent: '#eab308', text: 'text-yellow-400' }
};

const CATEGORIES = [
    { id: 'reward', label: 'PREMIOS', icon: <Ticket size={24} /> },
    { id: 'consumable', label: 'POCIONES', icon: <Heart size={24} /> },
    { id: 'avatar', label: 'AVATAR', icon: <User size={24} /> },
    { id: 'frame', label: 'MARCOS', icon: <ScanFace size={24} /> },
    { id: 'theme', label: 'TEMAS', icon: <Palette size={24} /> },
    { id: 'chest', label: 'COFRES', icon: <Package size={24} /> },
    { id: 'pet', label: 'MASCOTAS', icon: <PawPrint size={24} /> },
    { id: 'title', label: 'TÍTULOS', icon: <Crown size={24} /> },
];

export default function Shop() {
    // 🔥 USAMOS ZUSTAND PARA ESTADO GLOBAL
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);

    // ESTADOS
    const [activeTab, setActiveTab] = useState('shop');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [toast, setToast] = useState(null);

    // 🔥 Vía SWR (antes useState+useEffect, que refetcheaba entero en cada visita
    // y siempre mostraba la pantalla de carga). Ahora queda cacheado.
    const { data: shopData, mutate: mutateShop, isLoading } = useSWR('/shop', fetcher);
    const shopItems = shopData || [];
    const loading = isLoading && !shopData;

    // Cofres
    const [rewardData, setRewardData] = useState(null);
    const [isChestModalOpen, setIsChestModalOpen] = useState(false);
    const [currentChestType, setCurrentChestType] = useState('wood');
    const [currentChestImage, setCurrentChestImage] = useState(null);

    // Items y Creación
    const [selectedItem, setSelectedItem] = useState(null);
    const [showCreator, setShowCreator] = useState(false);
    const [newReward, setNewReward] = useState({ name: '', price: '' });

    // Exchange
    const [showExchange, setShowExchange] = useState(false);
    const [exchangeAmount, setExchangeAmount] = useState(100);
    const [isExchanging, setIsExchanging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => { setSelectedCategory(null); }, [activeTab]);

    // 🔥 SCROLL AL INICIO CUANDO CAMBIA LA CATEGORÍA O LA PESTAÑA
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [selectedCategory, activeTab]);

    // El auto-cierre lo gestiona el propio componente Toast (3 s).
    // Aquí había un segundo temporizador de 2 s que competía con él y hacía que
    // el aviso desapareciera antes de tiempo.

    const showToast = (msg, type = 'success') => setToast({ message: msg, type });

    // LOGICA EXCHANGE
    const EXCHANGE_RATE = 100;
    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const maxExchangeable = Math.floor(currentFichas / EXCHANGE_RATE) * EXCHANGE_RATE;

    const handleExchange = async () => {
        if (exchangeAmount > currentFichas) return showToast("Faltan fichas", "error");
        if (exchangeAmount < 100) return showToast("Mínimo 100 fichas", "error");

        setIsExchanging(true);
        try {
            const res = await api.post('/shop/exchange', { amountGameCoins: parseInt(exchangeAmount) });

            // 🔥 ACTUALIZACIÓN INMEDIATA DEL USUARIO
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));

            showToast(`¡Canje Exitoso!`, "success");
            setShowExchange(false);
            setExchangeAmount(100);
        } catch (error) {
            showToast(error.response?.data?.message || "Error canje", "error");
        } finally { setIsExchanging(false); }
    };

    const handleCreate = async () => {
        if (!newReward.name || !newReward.price) return showToast("Faltan datos", "error");
        try {
            const res = await api.post('/shop/create', { name: newReward.name, price: parseInt(newReward.price) });
            mutateShop([res.data, ...shopItems], false);
            setShowCreator(false);
            setNewReward({ name: '', price: '' });
            showToast("Premio creado");
        } catch (error) { showToast("Error creando", "error"); }
    };

    const handleBuy = async () => {
        if (!selectedItem || isProcessing) return;
        setIsProcessing(true);
        try {
            const res = await api.post('/shop/buy', { itemId: selectedItem._id });

            // 🔥 ACTUALIZACIÓN CRÍTICA DEL SALDO
            if (res.data.user) {
                setUser(res.data.user);
                localStorage.setItem('user', JSON.stringify(res.data.user));
            }

            showToast("¡Comprado!", "success");
            setSelectedItem(null);
        } catch (error) {
            showToast(error.response?.data?.message || "Error en la compra", "error");
        } finally { setIsProcessing(false); }
    };

    const handleUse = async () => {
        if (!selectedItem || isProcessing) return;
        setIsProcessing(true);
        try {
            const res = await api.post('/shop/use', { itemId: selectedItem._id });

            // 🔥 ACTUALIZAR USUARIO
            if (res.data.user) {
                setUser(res.data.user);
                localStorage.setItem('user', JSON.stringify(res.data.user));
            }

            setSelectedItem(null);

            if (selectedItem.category === 'chest') {
                setRewardData(res.data.reward);
                setCurrentChestImage(selectedItem.icon);
                if (selectedItem.name.includes('Legendario')) setCurrentChestType('legendary');
                else if (selectedItem.name.includes('Dorado')) setCurrentChestType('gold');
                else setCurrentChestType('wood');
                setIsChestModalOpen(true);
            } else {
                showToast(res.data.message);
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Error al usar", "error");
        } finally { setIsProcessing(false); }
    };

    const getFilteredItems = () => {
        if (!selectedCategory) return [];
        if (activeTab === 'shop') return shopItems.filter(item => item && item.category === selectedCategory);
        // Filtramos el inventario para mostrar items reales
        return (user?.inventory || [])
            .filter(slot => slot?.item && slot.item.category === selectedCategory);
    };

    const itemsToShow = getFilteredItems();

    return (
        <div className="animate-in fade-in pb-24 relative min-h-screen select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER PRO (SIN BOTÓN RESET) */}
            <div className="flex justify-between items-end px-4 pt-6 pb-2 bg-black border-b border-zinc-900">
                <div>
                    <h1 className="text-[26px] font-black text-white uppercase tracking-[-0.045em] leading-none not-italic">Mercado</h1>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Gasta tu fortuna</p>
                </div>
            </div>

            {/* TABS FLOTANTES (STICKY) */}
            <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md pt-4 pb-4 px-4 border-b border-zinc-900/50">
                <div className="flex bg-zinc-900 p-1 rounded-2xl relative border border-zinc-800">
                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-yellow-500 rounded-xl transition-all duration-300 ease-out shadow-lg ${activeTab === 'inventory' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`} />
                    <button onClick={() => setActiveTab('shop')} className={`flex-1 z-10 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${activeTab === 'shop' ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <ShoppingBag size={14} /> Tienda
                    </button>
                    <button onClick={() => setActiveTab('inventory')} className={`flex-1 z-10 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${activeTab === 'inventory' ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <Backpack size={14} /> Mochila
                    </button>
                </div>
            </div>

            <div className="px-4 pt-6">

                {/* WIDGET CASA DE CAMBIO (Solo en tienda principal) */}
                {activeTab === 'shop' && !selectedCategory && (
                    <div onClick={() => setShowExchange(true)} className="mb-5 relative overflow-hidden bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5 flex items-center justify-between cursor-pointer active:scale-[0.985] transition-all">
                        <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${ACENTO_FICHAS}, transparent)` }} />
                        <div className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] pointer-events-none" style={{ background: ACENTO_FICHAS, opacity: 0.11 }} />
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-[16px] bg-[#18181b] border border-white/[0.07] flex items-center justify-center" style={{ color: ACENTO_FICHAS }}>
                                <ArrowRightLeft size={22} />
                            </div>
                            <div>
                                <h3 className="text-white font-black text-[15px] uppercase tracking-[0.02em] leading-none not-italic">Casa de cambio</h3>
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide mt-1.5">100 fichas · 1 moneda</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* GRID CATEGORÍAS */}
                {!selectedCategory ? (
                    <div className="grid grid-cols-2 gap-3 pb-8 animate-in fade-in slide-in-from-bottom-4">
                        {CATEGORIES.map(cat => (
                            <div key={cat.id} onClick={() => setSelectedCategory(cat.id)} className="aspect-[4/3] bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] flex flex-col items-center justify-center gap-2.5 transition-all active:scale-[0.985] cursor-pointer group relative overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${ACENTO_TIENDA}, transparent)` }} />
                                <div className="text-zinc-600 group-hover:text-zinc-300 transition-colors relative z-10">{cat.icon}</div>
                                <span className="font-black text-[10px] text-zinc-500 group-hover:text-white tracking-[0.16em] relative z-10 uppercase not-italic">{cat.label}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-8 pb-20">
                        {/* Header Categoría */}
                        <div className="flex items-center gap-4 mb-6">
                            <BackButton onClick={() => setSelectedCategory(null)} />
                            <h2 className="text-xl font-black uppercase tracking-tighter italic text-white">{CATEGORIES.find(c => c.id === selectedCategory)?.label}</h2>
                        </div>

                        {loading ? <div className="text-center py-20 text-zinc-500 animate-pulse font-bold text-xs uppercase">Cargando mercancía...</div> : (
                            <div className="grid grid-cols-2 gap-3">
                                {/* Botón Crear (Solo en Premios y Tienda) */}
                                {activeTab === 'shop' && selectedCategory === 'reward' && (
                                    <div onClick={() => setShowCreator(true)} className="aspect-square border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-zinc-900 hover:border-yellow-500/50 transition-all cursor-pointer group bg-black/20">
                                        <div className="bg-zinc-800 p-3 rounded-full text-zinc-500 group-hover:text-yellow-500 transition-colors"><Plus size={24} /></div>
                                        <span className="text-[10px] font-black text-zinc-500 uppercase group-hover:text-yellow-500">Crear Nuevo</span>
                                    </div>
                                )}

                                {/* LISTA DE ITEMS */}
                                {itemsToShow.map(slotOrItem => {
                                    // Normalizamos: En tienda es 'item', en inventario 'slot.item'
                                    const item = activeTab === 'shop' ? slotOrItem : slotOrItem.item;
                                    if (!item) return null;

                                    // 🔥 LÓGICA DE PROPIEDAD BLINDADA
                                    // Un objeto del inventario puede apuntar a un item retirado del
                                    // catálogo: entonces llega como null y hacer `s.item._id` reventaba
                                    // el render entero (pantalla en negro justo después de comprar).
                                    const isOwned = (user?.inventory || []).some(s => {
                                        if (!s?.item) return false;
                                        const invItemId = s.item._id || s.item;
                                        return String(invItemId) === String(item._id);
                                    });

                                    // Categorías únicas
                                    const isUnique = ['avatar', 'frame', 'theme', 'title', 'pet'].includes(item.category);

                                    // ¿Está comprado y es único? (Solo aplica en modo tienda para bloquear)
                                    const purchased = activeTab === 'shop' && isOwned && isUnique;

                                    const isReward = item.category === 'reward';
                                    const iconPath = isReward ? "/assets/icons/moneda.png" : "/assets/icons/ficha.png";

                                    const rarity = RARITIES[item.rarity] || RARITIES.comun;

                                    return (
                                        <div
                                            key={item._id}
                                            onClick={() => { if (!purchased) setSelectedItem(item); }}
                                            className={`
                                                relative bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-4 flex flex-col items-center justify-between transition-all min-h-[160px] overflow-hidden
                                                ${purchased ? 'opacity-40 grayscale cursor-default' : 'cursor-pointer active:scale-[0.985]'}
                                            `}
                                        >
                                            {/* Línea de acento de 2px con el color de la rareza */}
                                            <div
                                                className="absolute inset-x-0 top-0 h-[2px] z-20 pointer-events-none"
                                                style={{ background: `linear-gradient(90deg, ${rarity.accent}, transparent)` }}
                                            />

                                            {/* Halo suave del mismo color, al 11% como el resto */}
                                            {item.rarity && item.rarity !== 'comun' && (
                                                <div
                                                    className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] pointer-events-none"
                                                    style={{ background: rarity.accent, opacity: 0.11 }}
                                                />
                                            )}

                                            <div className="h-14 w-14 mb-2 flex items-center justify-center relative z-10">
                                                {(item.icon?.startsWith('/') || item.icon?.startsWith('http')) ?
                                                    <img src={item.icon} className="w-full h-full object-contain filter drop-shadow-lg" />
                                                    : <div className="text-4xl">{item.icon}</div>}
                                            </div>

                                            <div className="text-center w-full relative z-10">
                                                <h3 className="text-[10px] font-black text-white truncate w-full mb-1 uppercase tracking-wide">{item.name}</h3>
                                                {item.rarity && item.rarity !== 'comun' && (
                                                    <p className={`text-[7px] font-black uppercase tracking-[0.15em] mb-2 ${rarity.text}`}>{rarity.label}</p>
                                                )}
                                                {(!item.rarity || item.rarity === 'comun') && <div className="mb-2" />}

                                                {purchased ? (
                                                    <div className="text-[8px] font-black text-green-500 uppercase tracking-widest bg-green-900/10 px-2 py-1 rounded border border-green-500/20">ADQUIRIDO</div>
                                                ) : (
                                                    <>
                                                        {activeTab === 'shop' && (
                                                            <div className={`text-[10px] font-black px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 border ${isReward ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' : 'text-purple-400 bg-purple-500/10 border-purple-500/20'}`}>
                                                                {item.price}
                                                                <img src={iconPath} className="w-5 h-5 object-contain mt-1" />
                                                            </div>
                                                        )}
                                                        {activeTab === 'inventory' && (
                                                            <div className="text-[9px] font-black text-zinc-500 bg-zinc-900 px-2 py-1 rounded inline-block uppercase border border-zinc-800">
                                                                {isUnique ? 'EN PROPIEDAD' : `X ${slotOrItem.quantity}`}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MODALES FULL SCREEN */}

            {/* 1. Detalle / Compra */}
            {selectedItem && (() => {
                // El acento del modal es el de la rareza del objeto que acabas de
                // tocar: ata la ficha con la tarjeta de la que vienes. Antes era un
                // borrón amarillo fijo, igual para un común que para un legendario.
                const rarezaSel = RARITIES[selectedItem.rarity] || RARITIES.comun;
                return (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in h-screen w-screen">
                    <div className="w-full max-w-sm bg-[#09090b] border border-white/[0.07] rounded-[32px] p-8 relative flex flex-col items-center text-center shadow-2xl overflow-hidden">
                        {/* Acento de 2px + halo al 11%, como las tarjetas */}
                        <div
                            className="absolute inset-x-0 top-0 h-[2px] pointer-events-none"
                            style={{ background: `linear-gradient(90deg, ${rarezaSel.accent}, transparent)` }}
                        />
                        <div
                            className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] pointer-events-none"
                            style={{ background: rarezaSel.accent, opacity: 0.11 }}
                        />

                        <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-zinc-900 p-2 rounded-full transition-colors border border-zinc-800 z-20"><X size={20} /></button>

                        <div className="w-28 h-28 bg-[#18181b] rounded-[24px] flex items-center justify-center mb-5 border border-white/[0.07] overflow-hidden relative z-10">
                            {(selectedItem.icon?.startsWith('/') || selectedItem.icon?.startsWith('http')) ? <img src={selectedItem.icon} className="w-full h-full object-cover" /> : <div className="text-6xl">{selectedItem.icon}</div>}
                        </div>

                        {/* La rareza no se veía en ningún sitio de la ficha */}
                        <span
                            className="relative z-10 text-[9px] font-black uppercase tracking-[0.16em] px-2.5 py-1 rounded-lg border not-italic mb-3"
                            style={{ color: rarezaSel.accent, borderColor: rarezaSel.accent + '55', backgroundColor: rarezaSel.accent + '15' }}
                        >
                            {rarezaSel.label}
                        </span>

                        <h2 className="relative z-10 text-[22px] font-black uppercase text-white leading-none tracking-[-0.045em] not-italic">{selectedItem.name}</h2>
                        <p className="relative z-10 text-[12px] text-zinc-500 mb-7 mt-2.5 leading-snug px-2">
                            {selectedItem.description || "Sin descripción disponible"}
                        </p>

                        <button
                            onClick={activeTab === 'shop' ? handleBuy : handleUse}
                            disabled={isProcessing}
                            className={`relative z-10 w-full py-4 rounded-2xl font-black uppercase tracking-[0.12em] text-xs transition-all active:scale-95 border-b-4 flex items-center justify-center gap-2
                                ${activeTab === 'shop'
                                    ? (selectedItem.category === 'reward' ? 'bg-yellow-500 text-black hover:bg-yellow-400 border-yellow-700' : 'bg-purple-600 text-white hover:bg-purple-500 border-purple-800')
                                    : 'bg-green-600 text-white hover:bg-green-500 border-green-800'
                                }`}
                        >
                            {isProcessing ? <Loader2 className="animate-spin" /> : (
                                activeTab === 'shop' ? (
                                    <>
                                        Comprar · {selectedItem.price}
                                        <img src={selectedItem.category === 'reward' ? "/assets/icons/moneda.png" : "/assets/icons/ficha.png"} className="w-5 h-5 object-contain" />
                                    </>
                                ) : (selectedItem.category === 'chest' ? 'Abrir cofre' : 'Usar objeto')
                            )}
                        </button>
                    </div>
                </div>
                );
            })()}

            {/* 2. Crear Premio */}
            {showCreator && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in h-screen w-screen">
                    <div className="w-full max-w-sm bg-[#09090b] border border-white/[0.07] rounded-[32px] p-6 relative shadow-2xl overflow-hidden">
                        <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${ACENTO_TIENDA}, transparent)` }} />
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h3 className="text-[20px] font-black text-white uppercase tracking-[-0.045em] leading-none not-italic">Nuevo premio</h3>
                            <button onClick={() => setShowCreator(false)} className="text-zinc-500 hover:text-white bg-zinc-900 p-2 rounded-full border border-zinc-800"><X size={20} /></button>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 block mb-2 tracking-widest">Nombre</label>
                                <input type="text" placeholder="Ej: 1h Videojuegos" autoFocus value={newReward.name} onChange={e => setNewReward({ ...newReward, name: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-white font-bold text-sm outline-none focus:ring-0 focus:border-yellow-500/50 transition-colors placeholder:text-zinc-700" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 block mb-2 tracking-widest">Precio</label>
                                <input type="number" placeholder="Ej: 100" value={newReward.price} onChange={e => setNewReward({ ...newReward, price: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-white font-bold text-sm outline-none focus:ring-0 focus:border-yellow-500/50 transition-colors placeholder:text-zinc-700" />
                            </div>
                            <button onClick={handleCreate} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl mt-4 transition-all active:scale-95 flex items-center justify-center gap-2 border-b-4 border-yellow-700 uppercase tracking-[0.12em] text-xs">
                                <Save size={16} /> Crear premio
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Modal Canje */}
            {showExchange && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in h-screen w-screen">
                    <div className="bg-[#09090b] w-full max-w-sm rounded-[32px] border border-white/[0.07] p-6 shadow-2xl relative overflow-hidden">
                        {/* Acento y halo de la casa de cambio: morado, el color de
                            las fichas, que es lo que entregas aquí. */}
                        <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${ACENTO_FICHAS}, transparent)` }} />
                        <div className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] pointer-events-none" style={{ background: ACENTO_FICHAS, opacity: 0.11 }} />

                        <div className="flex justify-between items-center mb-7 relative z-10">
                            <h3 className="text-[20px] font-black text-white uppercase tracking-[-0.045em] leading-none not-italic">Casa de cambio</h3>
                            <button onClick={() => setShowExchange(false)} className="text-zinc-500 hover:text-white bg-zinc-900 p-2 rounded-full border border-zinc-800"><X size={20} /></button>
                        </div>

                        <div className="flex items-center justify-between mb-7 bg-[#18181b] p-4 rounded-[24px] border border-white/[0.07] relative z-10">
                            <div className="text-center flex flex-col items-center">
                                <span className="block text-2xl font-black text-purple-400 leading-none mb-2">{exchangeAmount}</span>
                                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1">
                                    <img src="/assets/icons/ficha.png" className="w-6 h-6 object-contain mt-1" /> Fichas
                                </span>
                            </div>
                            <div className="text-zinc-600"><ArrowRightLeft size={20} /></div>
                            <div className="text-center flex flex-col items-center">
                                <span className="block text-2xl font-black text-yellow-500 leading-none mb-2">{Math.floor(exchangeAmount / 100)}</span>
                                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1">
                                    <img src="/assets/icons/moneda.png" className="w-6 h-6 object-contain mt-1" /> Monedas
                                </span>
                            </div>
                        </div>

                        <div className="mb-6 relative z-10">
                            <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block ml-1 tracking-widest">Cantidad a cambiar</label>
                            <input
                                type="number"
                                step="100"
                                min="100"
                                value={exchangeAmount}
                                onChange={e => setExchangeAmount(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-white font-black text-center text-xl outline-none focus:ring-0 focus:border-yellow-500/50 transition-colors"
                            />
                            <div className="flex justify-between mt-3 gap-2">
                                <button onClick={() => setExchangeAmount(100)} className="text-[9px] font-black bg-zinc-900 px-4 py-2 rounded-xl text-zinc-500 hover:text-white border border-zinc-800 uppercase tracking-wide flex-1">Mínimo</button>
                                <button onClick={() => setExchangeAmount(maxExchangeable)} className="text-[9px] font-black bg-zinc-900 px-4 py-2 rounded-xl text-blue-400 hover:text-blue-300 border border-zinc-800 uppercase tracking-wide flex-1">Máximo</button>
                            </div>
                        </div>

                        <button onClick={handleExchange} disabled={isExchanging} className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black hover:bg-yellow-400 active:scale-95 transition-all flex justify-center items-center gap-2 border-b-4 border-yellow-700 uppercase tracking-[0.12em] text-xs relative z-10">
                            {isExchanging ? <Loader2 className="animate-spin" /> : 'Confirmar canje'}
                        </button>
                    </div>
                </div>
            )}

            <ChestModal isOpen={isChestModalOpen} onClose={() => setIsChestModalOpen(false)} reward={rewardData} chestType={currentChestType} chestImage={currentChestImage} />
        </div>
    );
}