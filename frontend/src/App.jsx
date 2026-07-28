import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SWRConfig } from 'swr';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/common/LoadingScreen';
import api from './services/api';

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

// Fetcher único para toda la app
const fetcher = (url) => api.get(url).then(res => res.data);

const swrOptions = {
    fetcher,
    // 🔥 CLAVE PARA LA FLUIDEZ: al volver a una sección ya visitada se pintan los
    // datos que ya teníamos mientras se revalidan por detrás, en vez de mostrar
    // la pantalla de carga otra vez.
    keepPreviousData: true,
    // Evita repetir la misma petición si dos componentes la piden a la vez
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    // Con el backend en Render (plan gratuito) una petición puede fallar por
    // arranque en frío: reintentamos un par de veces con margen.
    errorRetryCount: 2,
    errorRetryInterval: 3000
};

function App() {
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

                            {/* Juegos */}
                            <Route path="/games" element={<Games />} />
                            <Route path="/games/fortune-wheel" element={<FortuneWheel />} />
                            <Route path="/games/scratch" element={<ScratchGame />} />
                            <Route path="/games/dice" element={<DiceGame />} />
                            <Route path="/games/roulette" element={<Roulette />} />
                            <Route path="/games/blackjack" element={<BlackJack />} />
                            <Route path="/games/slots" element={<Slots />} />
                        </Route>
                    </Routes>
                </Suspense>
            </Router>
        </SWRConfig>
    );
}

export default App;
