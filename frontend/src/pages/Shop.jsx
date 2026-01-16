import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Plus, X, ArrowLeft, RefreshCw, ArrowRightLeft,
    Ticket, Heart, User, ScanFace, Palette, Package, PawPrint, Crown,
    ShoppingBag, Backpack, Save, Loader2, Coins
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';
import ChestModal from '../components/common/ChestModal';

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
    const { user, setUser, setIsUiHidden } = useOutletContext();

    // ESTADOS
    const [activeTab, setActiveTab] = useState('shop');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [shopItems, setShopItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

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

    useEffect(() => { fetchShop(); }, []);
    useEffect(() => { setSelectedCategory(null); }, [activeTab]);

    // 🔥 SCROLL AL INICIO CUANDO CAMBIA LA CATEGORÍA O LA PESTAÑA
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [selectedCategory, activeTab]);

    // Auto-cierre del toast
    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 2000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const fetchShop = async () => {
        setLoading(true);
        try {
            const res = await api.get('/shop');
            setShopItems(res.data);
        } catch (error) { console.error("Error tienda:", error); }
        finally { setLoading(false); }
    };

    const showToast = (msg, type = 'success') => setToast({ message: msg, type });

    const handleResetShop = async () => {
        if (!window.confirm("¿Vaciar toda la tienda?")) return;
        try {
            await api.post('/shop/seed');
            fetchShop();
            showToast("Tienda reiniciada", "info");
        } catch (error) { showToast("Error reset", "error"); }
    };

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
            setShopItems([res.data, ...shopItems]);
            setShowCreator(false);
            setNewReward({ name: '', price: '' });
            showToast("Premio creado");
        } catch (error) { showToast("Error creando", "error"); }
    };

    const handleBuy = async () => {
        if (!selectedItem || isProcessing) return;
        setIsProcessing(true);
        try {
            const endpoint = selectedItem.category === 'reward' ? '/shop/buy-reward' : '/shop/buy';
            await api.post(endpoint, { itemId: selectedItem._id });

            const resUser = await api.get('/auth/me');
            setUser(resUser.data);

            showToast("¡Comprado!", "success");
            setSelectedItem(null);
        } catch (error) {
            showToast(error.response?.data?.message || "No tienes saldo", "error");
        } finally { setIsProcessing(false); }
    };

    const handleUse = async () => {
        if (!selectedItem || isProcessing) return;
        setIsProcessing(true);
        try {
            const res = await api.post('/shop/use', { itemId: selectedItem._id });
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
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
        if (activeTab === 'shop') return shopItems.filter(item => item.category === selectedCategory);
        return (user?.inventory || []).filter(slot => slot.item && slot.item.category === selectedCategory);
    };

    const itemsToShow = getFilteredItems();

    return (
        <div className="animate-in fade-in pb-24 relative min-h-screen select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER PRO (NO STICKY) */}
            <div className="flex justify-between items-end px-4 pt-6 pb-2 bg-black border-b border-zinc-900">
                <div>
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">MERCADO</h1>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Gasta tu fortuna</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleResetShop} className="bg-zinc-900 p-2 rounded-full text-zinc-600 hover:text-red-500 border border-zinc-800 transition-colors"><RefreshCw size={18} /></button>
                </div>
            </div>

            {/* TABS FLOTANTES (AHORA SÍ SON STICKY) */}
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
                    <div onClick={() => setShowExchange(true)} className="mb-6 bg-zinc-950 border border-purple-500/20 rounded-[32px] p-5 flex items-center justify-between cursor-pointer active:scale-95 transition-all hover:bg-zinc-900 group shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors border border-purple-500/10">
                                <ArrowRightLeft size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-black text-lg italic uppercase tracking-tight">Casa de Cambio</h3>
                                <p className="text-xs text-zinc-500 font-bold uppercase">100 Fichas ➔ 1 Moneda</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* GRID CATEGORÍAS */}
                {!selectedCategory ? (
                    <div className="grid grid-cols-2 gap-3 pb-8 animate-in fade-in slide-in-from-bottom-4">
                        {CATEGORIES.map(cat => (
                            <div key={cat.id} onClick={() => setSelectedCategory(cat.id)} className="aspect-[4/3] bg-zinc-950 border border-zinc-800 rounded-[28px] flex flex-col items-center justify-center gap-2 hover:border-yellow-500/30 transition-all active:scale-95 cursor-pointer group relative overflow-hidden shadow-lg">
                                <div className="text-zinc-600 group-hover:text-yellow-500 group-hover:scale-110 transition-all duration-300 relative z-10">{cat.icon}</div>
                                <span className="font-black text-[10px] text-zinc-500 group-hover:text-white tracking-widest relative z-10 uppercase">{cat.label}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-8 pb-20">
                        {/* Header Categoría */}
                        <div className="flex items-center gap-4 mb-6">
                            <button onClick={() => setSelectedCategory(null)} className="bg-zinc-900 p-3 rounded-full hover:text-white active:scale-90 transition-transform text-zinc-400 border border-zinc-800"><ArrowLeft size={20} /></button>
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
                                    const item = activeTab === 'shop' ? slotOrItem : slotOrItem.item;
                                    const isOwned = user?.inventory?.some(s => s.item && s.item._id === item._id);
                                    const isUnique = ['avatar', 'frame', 'theme', 'title', 'pet'].includes(item.category);
                                    const purchased = activeTab === 'shop' && isOwned && isUnique;
                                    const isReward = item.category === 'reward';

                                    const iconPath = isReward ? "/assets/icons/moneda.png" : "/assets/icons/ficha.png";

                                    return (
                                        <div
                                            key={item._id}
                                            onClick={() => { if (!purchased) setSelectedItem(item); }}
                                            className={`
                                                relative bg-zinc-950 border border-zinc-800 rounded-3xl p-4 flex flex-col items-center justify-between transition-all shadow-md min-h-[160px]
                                                ${purchased ? 'opacity-50 grayscale cursor-default' : 'hover:border-yellow-500/30 cursor-pointer active:scale-95'}
                                            `}
                                        >
                                            <div className="h-14 w-14 mb-2 flex items-center justify-center">
                                                {(item.icon?.startsWith('/') || item.icon?.startsWith('http')) ?
                                                    <img src={item.icon} className="w-full h-full object-contain filter drop-shadow-lg" />
                                                    : <div className="text-4xl">{item.icon}</div>}
                                            </div>

                                            <div className="text-center w-full">
                                                <h3 className="text-[10px] font-black text-white truncate w-full mb-3 uppercase tracking-wide">{item.name}</h3>

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
            {selectedItem && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in h-screen w-screen">
                    <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[32px] p-8 relative flex flex-col items-center text-center shadow-2xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>

                        <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-zinc-900 p-2 rounded-full transition-colors border border-zinc-800"><X size={20} /></button>

                        <div className="w-28 h-28 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-zinc-800 overflow-hidden relative">
                            {(selectedItem.icon?.startsWith('/') || selectedItem.icon?.startsWith('http')) ? <img src={selectedItem.icon} className="w-full h-full object-cover" /> : <div className="text-6xl animate-bounce-slow">{selectedItem.icon}</div>}
                        </div>

                        <h2 className="text-xl font-black uppercase text-white mb-2 leading-tight italic tracking-wide">{selectedItem.name}</h2>
                        <p className="text-xs font-bold text-zinc-500 mb-8 uppercase tracking-widest px-4">
                            {selectedItem.description || "Sin descripción disponible"}
                        </p>

                        <button
                            onClick={activeTab === 'shop' ? handleBuy : handleUse}
                            disabled={isProcessing}
                            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95 border-b-4 flex items-center justify-center gap-2
                                ${activeTab === 'shop'
                                    ? (selectedItem.category === 'reward' ? 'bg-yellow-500 text-black hover:bg-yellow-400 border-yellow-700' : 'bg-purple-600 text-white hover:bg-purple-500 border-purple-800')
                                    : 'bg-green-600 text-white hover:bg-green-500 border-green-800'
                                }`}
                        >
                            {isProcessing ? <Loader2 className="animate-spin" /> : (
                                activeTab === 'shop' ? (
                                    <>
                                        COMPRAR • {selectedItem.price}
                                        <img src={selectedItem.category === 'reward' ? "/assets/icons/moneda.png" : "/assets/icons/ficha.png"} className="w-5 h-5 object-contain mt-0.5" />
                                    </>
                                ) : (selectedItem.category === 'chest' ? 'ABRIR COFRE' : 'USAR ITEM')
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* 2. Crear Premio */}
            {showCreator && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in h-screen w-screen">
                    <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[32px] p-6 relative shadow-2xl">
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Nuevo <span className="text-yellow-500">Premio</span></h3>
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
                            <button onClick={handleCreate} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl mt-4 transition-all active:scale-95 flex items-center justify-center gap-2 border-b-4 border-yellow-700 uppercase tracking-widest text-xs">
                                <Save size={16} /> CREAR PREMIO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Modal Canje */}
            {showExchange && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in h-screen w-screen">
                    <div className="bg-zinc-950 w-full max-w-sm rounded-[32px] border border-zinc-800 p-6 shadow-2xl relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>

                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Casa de <span className="text-yellow-500">Cambio</span></h3>
                            <button onClick={() => setShowExchange(false)} className="text-zinc-500 hover:text-white bg-zinc-900 p-2 rounded-full border border-zinc-800"><X size={20} /></button>
                        </div>

                        <div className="flex items-center justify-between mb-8 bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800 relative z-10">
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

                        <button onClick={handleExchange} disabled={isExchanging} className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black shadow-lg hover:bg-yellow-400 active:scale-95 transition-all flex justify-center items-center gap-2 border-b-4 border-yellow-700 uppercase tracking-widest text-xs relative z-10">
                            {isExchanging ? <Loader2 className="animate-spin" /> : 'CONFIRMAR CANJE'}
                        </button>
                    </div>
                </div>
            )}

            <ChestModal isOpen={isChestModalOpen} onClose={() => setIsChestModalOpen(false)} reward={rewardData} chestType={currentChestType} chestImage={currentChestImage} />
        </div>
    );
}