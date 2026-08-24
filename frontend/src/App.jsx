import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SWRConfig } from 'swr';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/common/LoadingScreen';
import api from './services/api';
import { proveedorCache } from './utils/swrCache';

// --- CARGA INMEDIATA ---
// Login/Register (puerta de entrada) y Home (primera pantalla tras entrar) van en el
// bundle principal para que la app arranque sin saltos.
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';

// --- CARGA DIFERIDA (code splitting) ---
// El bundle era de ~1 MB en un único fichero: el móvil tenía que descargarlo y
// procesarlo ENTERO antes de pintar nada. Partiéndolo, cada sección se descarga
// solo cuando se entra en ella (y Layout la precarga en segundo plano, así que
// para cuando el usuario pulsa ya suele estar lista).
const Missions = lazy(() => import('./pages/Missions'));
const Food = lazy(() => import('./pages/Food'));
const Gym = lazy(() => import('./pages/Gym'));
const Shop = lazy(() => import('./pages/Shop'));
const Profile = lazy(() => import('./pages/Profile'));
const Social = lazy(() => import('./pages/Social'));
const Settings = lazy(() => import('./pages/Settings'));
// Solo lo carga quien entra, y solo entra quien es administrador.
const Admin = lazy(() => import('./pages/Admin'));
const Privacidad = lazy(() => import('./pages/Privacidad'));

const FriendsPage = lazy(() => import('./pages/social/FriendsPage'));
const ClansPage = lazy(() => import('./pages/social/ClansPage'));
const RankingPage = lazy(() => import('./pages/social/RankingPage'));
const UserProfilePage = lazy(() => import('./pages/social/UserProfilePage'));

const Games = lazy(() => import('./pages/Games'));
const FortuneWheel = lazy(() => import('./pages/games/FortuneWheel'));
const ScratchGame = lazy(() => import('./pages/games/ScratchGame'));
const DiceGame = lazy(() => import('./pages/games/DiceGame'));
const Roulette = lazy(() => import('./pages/games/Roulette'));
const BlackJack = lazy(() => import('./pages/games/BlackJack'));
const Slots = lazy(() => import('./pages/games/Slots'));
const TowerGame = lazy(() => import('./pages/games/TowerGame'));

/**
 * Los mismos cargadores que usa lazy(), en una lista aparte para poder
 * dispararlos a mano.
 *
 * El troceado por rutas evita descargar 1 MB de golpe al abrir la app, pero
 * traslada la descarga al momento en que pulsas: la primera vez que entras en
 * una sección hay que ir a por su trozo, y eso es justo el tirón que se nota.
 * Precargándolos cuando el navegador está ocioso se tienen las dos cosas:
 * arranque ligero y navegación instantánea a partir de ahí.
 */
const CARGADORES = [
    () => import('./pages/Missions'),
    () => import('./pages/Gym'),
    () => import('./pages/Food'),
    () => import('./pages/Shop'),
    () => import('./pages/Social'),
    () => import('./pages/Profile'),
    () => import('./pages/Games'),
    () => import('./pages/Settings'),
    () => import('./pages/social/FriendsPage'),
    () => import('./pages/social/ClansPage'),
    () => import('./pages/social/RankingPage'),
    () => import('./pages/social/UserProfilePage'),
    () => import('./pages/games/FortuneWheel'),
    () => import('./pages/games/ScratchGame'),
    () => import('./pages/games/DiceGame'),
    () => import('./pages/games/Roulette'),
    () => import('./pages/games/BlackJack'),
    () => import('./pages/games/Slots'),
    () => import('./pages/games/TowerGame')
];

// De uno en uno y sólo con el navegador ocioso, para no competir con las
// peticiones de la pantalla en la que estás.
const precargarSecciones = () => {
    let i = 0;
    const siguiente = () => {
        if (i >= CARGADORES.length) return;
        CARGADORES[i++]().catch(() => { /* si falla, lazy lo reintentará al entrar */ });
        programar(siguiente);
    };
    const programar = (fn) => (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(fn, { timeout: 2000 });
    programar(siguiente);
};

// Fetcher único para toda la app
const fetcher = (url) => api.get(url).then(res => res.data);

const swrOptions = {
    fetcher,
    // Caché que sobrevive a la recarga. Sin esto, Home aparecía lleno (su
    // usuario se guarda en localStorage) y el resto de secciones en blanco
    // esperando a un servidor que tarda 30-50 s en despertar.
    provider: proveedorCache,
    // 🔥 CLAVE PARA LA FLUIDEZ: al volver a una sección ya visitada se pintan los
    // datos que ya teníamos mientras se revalidan por detrás, en vez de mostrar
    // la pantalla de carga otra vez.
    keepPreviousData: true,
    // Evita repetir la misma petición si dos componentes la piden a la vez
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    // Con el backend en Render (plan gratuito) el servidor se duerme y tarda
    // entre 30 y 50 segundos en despertar.
    // ⚠️ Antes eran 2 reintentos cada 3 s: a los ~6 segundos SWR tiraba la toalla,
    // mucho antes de que el servidor estuviera listo, y las pantallas se quedaban
    // con los datos vacíos (el feed decía "no hay entrenos" con el servidor aún
    // arrancando). Con 6 reintentos y 5 s de base se cubre el arranque en frío.
    errorRetryCount: 6,
    errorRetryInterval: 5000
};

function App() {
    // Tras el primer render, se van trayendo en segundo plano los trozos del
    // resto de secciones para que al pulsar no haya nada que descargar.
    useEffect(() => { precargarSecciones(); }, []);

    return (
        <SWRConfig value={swrOptions}>
            <Router>
                <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                        {/* Rutas Públicas */}
                        <Route path="/" element={<Navigate to="/login" replace />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        {/* Rutas Privadas (Con Header y Footer) */}
                        <Route element={<Layout />}>
                            <Route path="/home" element={<Home />} />
                            <Route path="/missions" element={<Missions />} />
                            <Route path="/food" element={<Food />} />
                            <Route path="/gym" element={<Gym />} />
                            <Route path="/shop" element={<Shop />} />
                            <Route path="/social" element={<Social />} /> {/* Feed */}
                            <Route path="/social/friends" element={<FriendsPage />} />
                            <Route path="/social/clans" element={<ClansPage />} />
                            <Route path="/social/ranking" element={<RankingPage />} />
                            <Route path="/social/user/:userId" element={<UserProfilePage />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/admin" element={<Admin />} />
                            <Route path="/privacidad" element={<Privacidad />} />

                            {/* Juegos */}
                            <Route path="/games" element={<Games />} />
                            <Route path="/games/fortune-wheel" element={<FortuneWheel />} />
                            <Route path="/games/scratch" element={<ScratchGame />} />
                            <Route path="/games/dice" element={<DiceGame />} />
                            <Route path="/games/roulette" element={<Roulette />} />
                            <Route path="/games/blackjack" element={<BlackJack />} />
                            <Route path="/games/slots" element={<Slots />} />
                            <Route path="/games/tower" element={<TowerGame />} />
                        </Route>
                    </Routes>
                </Suspense>
            </Router>
        </SWRConfig>
    );
}

export default App;
