import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Register from './pages/Register';
import Login from './pages/Login';

// Importar todas las páginas
import Home from './pages/Home';
import Missions from './pages/Missions';
import Food from './pages/Food';
import Gym from './pages/Gym';
import Shop from './pages/Shop';
import Profile from './pages/Profile';
import Social from './pages/Social'; // Feed social (pantalla principal de la sección)

// Subpáginas de la sección social
import FriendsPage from './pages/social/FriendsPage';
import ClansPage from './pages/social/ClansPage';
import RankingPage from './pages/social/RankingPage';
import UserProfilePage from './pages/social/UserProfilePage';

// Importar Juegos
import Games from './pages/Games';
import FortuneWheel from './pages/games/FortuneWheel';
import ScratchGame from './pages/games/ScratchGame';
import DiceGame from './pages/games/DiceGame';
import Roulette from './pages/games/Roulette';
import BlackJack from './pages/games/BlackJack';
import Slots from './pages/games/Slots';

function App() {
    return (
        <Router>
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
        </Router>
    );
}

export default App;