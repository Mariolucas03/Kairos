const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const crypto = require('crypto'); // 🔥 IMPORTACIÓN NATIVA DE NODE PARA SEGURIDAD

// --- UTILIDADES GLOBALES ---
const chargeAndValidate = async (userId, amount) => {
    if (amount <= 0) return await User.findById(userId);
    const user = await User.findOneAndUpdate(
        { _id: userId, gameCoins: { $gte: amount } },
        { $inc: { gameCoins: -amount } },
        { new: true }
    );
    if (!user) throw new Error('Fichas insuficientes o error de saldo');
    return user;
};

const payPrize = async (userId, amount) => {
    if (amount <= 0) return await User.findById(userId);
    return await User.findByIdAndUpdate(userId, { $inc: { gameCoins: amount } }, { new: true });
};

// ==========================================
// 1. DADOS (DICE)
// ==========================================
const playDice = asyncHandler(async (req, res) => {
    const { bet, prediction } = req.body;
    if (!bet || bet < 10) { res.status(400); throw new Error('Apuesta mínima 10'); }
    if (!['under', 'seven', 'over'].includes(prediction)) { res.status(400); throw new Error('Predicción inválida'); }

    await chargeAndValidate(req.user._id, bet);

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;

    let won = false; let multiplier = 0;
    if (prediction === 'under' && sum < 7) { won = true; multiplier = 2; }
    else if (prediction === 'seven' && sum === 7) { won = true; multiplier = 5; }
    else if (prediction === 'over' && sum > 7) { won = true; multiplier = 2; }

    const payout = won ? bet * multiplier : 0;
    const finalUser = await payPrize(req.user._id, payout);

    res.json({ won, payout, sum, dices: [d1, d2], user: finalUser });
});

// ==========================================
// 2. RASCA Y GANA (SCRATCH)
// ==========================================
const SCRATCH_SYMBOLS = {
    DIAMOND: { id: 'd', icon: '💎', prize: 500, type: 'coins', weight: 2 },
    XP: { id: 'x', icon: '⚡', prize: 200, type: 'xp', weight: 8 },
    COIN: { id: 'c', icon: '🪙', prize: 100, type: 'coins', weight: 15 },
    LEMON: { id: 'l', icon: '🍋', prize: 50, type: 'coins', weight: 25 },
    SKULL: { id: 's', icon: '💀', prize: 0, type: 'none', weight: 25 },
    POOP: { id: 'p', icon: '💩', prize: 0, type: 'none', weight: 25 }
};

const getRandomScratchSymbol = () => {
    const keys = Object.keys(SCRATCH_SYMBOLS);
    const totalWeight = keys.reduce((acc, k) => acc + SCRATCH_SYMBOLS[k].weight, 0);
    let r = Math.random() * totalWeight;
    for (const key of keys) {
        if (r < SCRATCH_SYMBOLS[key].weight) return SCRATCH_SYMBOLS[key];
        r -= SCRATCH_SYMBOLS[key].weight;
    }
    return SCRATCH_SYMBOLS.SKULL;
};

const playScratch = asyncHandler(async (req, res) => {
    const COST = 10;
    await chargeAndValidate(req.user._id, COST);

    const isWin = Math.random() < 0.35; // 35% Win Rate
    let items = [];

    if (isWin) {
        const pRand = Math.random();
        let winSym;
        if (pRand < 0.05) winSym = SCRATCH_SYMBOLS.DIAMOND;
        else if (pRand < 0.20) winSym = SCRATCH_SYMBOLS.XP;
        else if (pRand < 0.50) winSym = SCRATCH_SYMBOLS.COIN;
        else winSym = SCRATCH_SYMBOLS.LEMON;

        items.push(winSym, winSym, winSym);
        while (items.length < 9) {
            const filler = getRandomScratchSymbol();
            const count = items.filter(x => x.id === filler.id).length;
            items.push(count < 2 ? filler : SCRATCH_SYMBOLS.SKULL);
        }
    } else {
        for (let i = 0; i < 9; i++) items.push(getRandomScratchSymbol());
        const counts = {};
        items.forEach(i => counts[i.id] = (counts[i.id] || 0) + 1);
        Object.keys(counts).forEach(k => {
            if (counts[k] >= 3 && k !== 's' && k !== 'p') {
                let removed = 0;
                items = items.map(i => {
                    if (i.id === k && removed >= 2) return Math.random() > 0.5 ? SCRATCH_SYMBOLS.SKULL : SCRATCH_SYMBOLS.POOP;
                    if (i.id === k) removed++;
                    return i;
                });
            }
        });
    }

    items = items.sort(() => Math.random() - 0.5);

    const finalCounts = {};
    items.forEach(i => finalCounts[i.id] = (finalCounts[i.id] || 0) + 1);
    const winSymObj = Object.values(SCRATCH_SYMBOLS).find(s => finalCounts[s.id] >= 3 && s.type !== 'none');

    let finalUser = req.user;
    let payout = 0;

    if (winSymObj) {
        payout = winSymObj.prize;
        if (winSymObj.type === 'xp') {
            finalUser = await User.findByIdAndUpdate(req.user._id, { $inc: { currentXP: payout } }, { new: true });
        } else {
            finalUser = await payPrize(req.user._id, payout);
        }
    }

    res.json({ grid: items, won: !!winSymObj, prize: payout, prizeType: winSymObj?.type || 'none', user: finalUser });
});

// ==========================================
// 3. SLOTS (TRAGAPERRAS)
// ==========================================
const SLOT_SYMBOLS = [
    { id: 'cherry', icon: '🍒', val: 1.5, weight: 25 },
    { id: 'clover', icon: '🍀', val: 3, weight: 15 },
    { id: 'zap', icon: '⚡', val: 5, weight: 10 },
    { id: 'star', icon: '⭐', val: 10, weight: 8 },
    { id: 'gem', icon: '💎', val: 20, weight: 4 },
    { id: 'crown', icon: '👑', val: 50, weight: 1 },
    { id: 'skull', icon: '💀', val: 0, weight: 20 },
    { id: 'ghost', icon: '👻', val: 0, weight: 17 },
];

const getSlotSymbol = () => {
    const totalW = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * totalW;
    for (const s of SLOT_SYMBOLS) { if (r < s.weight) return s; r -= s.weight; }
    return SLOT_SYMBOLS[0];
};

const playSlots = asyncHandler(async (req, res) => {
    const { bet } = req.body;
    if (!bet || bet < 10) { res.status(400); throw new Error('Apuesta mínima 10'); }
    await chargeAndValidate(req.user._id, bet);

    const grid = Array(4).fill(null).map(() => Array(4).fill(null).map(() => getSlotSymbol()));
    const rows = [0, 1, 2, 3].map(r => [grid[0][r], grid[1][r], grid[2][r], grid[3][r]]);

    let totalPayout = 0;
    let winningCells = [];

    const checkLines = [
        { syms: rows[0], coords: [[0, 0], [1, 0], [2, 0], [3, 0]] },
        { syms: rows[1], coords: [[0, 1], [1, 1], [2, 1], [3, 1]] },
        { syms: rows[2], coords: [[0, 2], [1, 2], [2, 2], [3, 2]] },
        { syms: rows[3], coords: [[0, 3], [1, 3], [2, 3], [3, 3]] },
        { syms: [rows[0][0], rows[1][1], rows[2][2], rows[3][3]], coords: [[0, 0], [1, 1], [2, 2], [3, 3]] },
        { syms: [rows[0][3], rows[1][2], rows[2][1], rows[3][0]], coords: [[0, 3], [1, 2], [2, 1], [3, 0]] },
        { syms: grid[0], coords: [[0, 0], [0, 1], [0, 2], [0, 3]] },
        { syms: grid[1], coords: [[1, 0], [1, 1], [1, 2], [1, 3]] },
        { syms: grid[2], coords: [[2, 0], [2, 1], [2, 2], [2, 3]] },
        { syms: grid[3], coords: [[3, 0], [3, 1], [3, 2], [3, 3]] }
    ];

    checkLines.forEach(line => {
        const s = line.syms;
        if (s[0].val === 0) return;
        let matchIds = [];
        if (s[0].id === s[1].id && s[1].id === s[2].id && s[2].id === s[3].id) matchIds = [0, 1, 2, 3];
        else if (s[0].id === s[1].id && s[1].id === s[2].id) matchIds = [0, 1, 2];
        else if (s[1].id === s[2].id && s[2].id === s[3].id && s[1].val > 0) matchIds = [1, 2, 3];

        if (matchIds.length >= 3) {
            const multi = matchIds.length === 4 ? 2 : 1;
            totalPayout += bet * s[matchIds[0]].val * multi;
            matchIds.forEach(i => winningCells.push(`${line.coords[i][0]}-${line.coords[i][1]}`));
        }
    });

    const finalUser = await payPrize(req.user._id, totalPayout);
    res.json({ grid, won: totalPayout > 0, payout: totalPayout, winningCells, user: finalUser });
});

// ==========================================
// 4. RULETA
// ==========================================
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
const TABLE_COLUMNS = {
    1: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
    2: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    3: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]
};

// 🔥 TABLA DE APUESTAS CANÓNICA: nunca confiamos en "numbers"/"multiplier" del cliente,
// los recalculamos siempre a partir de type+value.
const getCanonicalRouletteBet = (type, value) => {
    switch (type) {
        case 'number': {
            const n = Number(value);
            if (!Number.isInteger(n) || n < 0 || n > 36) return null;
            return { numbers: [n], multiplier: 36 };
        }
        case 'column': {
            const col = Number(value);
            if (!TABLE_COLUMNS[col]) return null;
            return { numbers: TABLE_COLUMNS[col], multiplier: 3 };
        }
        case 'dozen': {
            const d = Number(value);
            if (![1, 2, 3].includes(d)) return null;
            return { numbers: Array.from({ length: 12 }, (_, i) => i + 1 + (d - 1) * 12), multiplier: 3 };
        }
        case 'low':
            return { numbers: Array.from({ length: 18 }, (_, i) => i + 1), multiplier: 2 };
        case 'high':
            return { numbers: Array.from({ length: 18 }, (_, i) => i + 19), multiplier: 2 };
        case 'even':
            return { numbers: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0), multiplier: 2 };
        case 'odd':
            return { numbers: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 !== 0), multiplier: 2 };
        case 'color':
            if (value === 'red') return { numbers: RED_NUMBERS, multiplier: 2 };
            if (value === 'black') return { numbers: BLACK_NUMBERS, multiplier: 2 };
            return null;
        default:
            return null;
    }
};

const playRoulette = asyncHandler(async (req, res) => {
    const { bets } = req.body;
    if (!Array.isArray(bets) || bets.length === 0) { res.status(400); throw new Error('Sin apuestas'); }
    if (bets.length > 50) { res.status(400); throw new Error('Demasiadas apuestas'); }

    const canonicalBets = [];
    for (const b of bets) {
        const amount = Number(b?.amount);
        if (!Number.isFinite(amount) || amount <= 0) { res.status(400); throw new Error('Apuesta inválida'); }
        const canonical = getCanonicalRouletteBet(b?.type, b?.value);
        if (!canonical) { res.status(400); throw new Error('Apuesta inválida'); }
        canonicalBets.push({ amount, ...canonical });
    }

    const totalBet = canonicalBets.reduce((a, b) => a + b.amount, 0);
    await chargeAndValidate(req.user._id, totalBet);

    const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    const winNum = WHEEL_NUMBERS[Math.floor(Math.random() * WHEEL_NUMBERS.length)];

    let totalWin = 0;
    canonicalBets.forEach(b => { if (b.numbers.includes(winNum)) totalWin += b.amount * b.multiplier; });

    const finalUser = await payPrize(req.user._id, totalWin);
    res.json({ winNum, totalWin, user: finalUser });
});

// ==========================================
// 5. RULETA DE LA FORTUNA
// ==========================================
const playFortuneWheel = asyncHandler(async (req, res) => {
    const { type } = req.body;
    const CONFIGS = { daily: 0, hardcore: 50, premium: 200 };
    const cost = CONFIGS[type];

    if (cost === undefined) { res.status(400); throw new Error('Tipo inválido'); }
    await chargeAndValidate(req.user._id, cost);

    const PRIZES = {
        daily: [{ v: 10, t: 'c' }, { v: 50, t: 'c' }, { v: 5, t: 'c' }, { v: 25, t: 'c' }, { v: 100, t: 'c' }, { v: 5, t: 'c' }],
        hardcore: [{ v: 0, t: 'c' }, { v: 0, t: 'c' }, { v: 1000, t: 'c' }, { v: 0, t: 'c' }, { v: 0, t: 'c' }, { v: 200, t: 'c' }],
        premium: [{ v: 250, t: 'c' }, { v: 300, t: 'c' }, { v: 500, t: 'c' }, { v: 210, t: 'c' }, { v: 400, t: 'c' }, { v: 1000, t: 'c' }]
    };

    const winIndex = Math.floor(Math.random() * PRIZES[type].length);
    const winObj = PRIZES[type][winIndex];

    let finalUser = req.user;
    if (winObj.v > 0) {
        if (winObj.t === 'xp') finalUser = await User.findByIdAndUpdate(req.user._id, { $inc: { currentXP: winObj.v } }, { new: true });
        else finalUser = await payPrize(req.user._id, winObj.v);
    }

    res.json({ winIndex, prize: winObj, user: finalUser });
});

// ==========================================
// 6. BLACKJACK (STATELESS / JWT) CON ANTI-CHEAT 🔥
// ==========================================
const SUITS = ['♠', '♥', '♣', '♦'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const createDeck = () => {
    let deck = [];
    for (let suit of SUITS) for (let value of VALUES) {
        let weight = parseInt(value);
        if (['J', 'Q', 'K'].includes(value)) weight = 10;
        if (value === 'A') weight = 11;
        deck.push({ suit, value, weight, id: Math.random().toString() });
    }
    return deck.sort(() => Math.random() - 0.5);
};

const calcScore = (hand) => {
    let score = 0, aces = 0;
    hand.forEach(c => { score += c.weight; if (c.value === 'A') aces++; });
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
};

// 🔥 El estado (incluye el mazo restante) se ENCRIPTA, no solo se firma:
// un JWT normal solo está codificado en base64 y el cliente podría decodificarlo
// para ver todas las cartas futuras (conteo de cartas / trampas). AES-256-GCM
// evita que el contenido sea legible, y la etiqueta de autenticación evita manipulación.
const getBlackjackKey = () => crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();

const encryptState = (state) => {
    const key = getBlackjackKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

const decryptState = (token) => {
    const key = getBlackjackKey();
    const raw = Buffer.from(token, 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
};

const playBlackjack = asyncHandler(async (req, res) => {
    const { action, bet, token } = req.body;
    let state;

    if (action === 'deal') {
        if (bet < 10) { res.status(400); throw new Error('Apuesta mínima 10'); }
        await chargeAndValidate(req.user._id, bet);

        const deck = createDeck();
        const gameId = crypto.randomBytes(16).toString('hex'); // 🔥 CANDADO ÚNICO

        // Guardamos el candado en el usuario
        await User.findByIdAndUpdate(req.user._id, { activeGameToken: gameId });

        state = {
            gameId, // Incluimos el candado en el estado que se va a firmar
            deck, 
            pHands: [{ cards: [deck.pop(), deck.pop()], bet, isDone: false, isDoubled: false }],
            dHand: [deck.pop(), deck.pop()], activeHand: 0, status: 'playing'
        };

        // Blackjack natural
        if (calcScore(state.pHands[0].cards) === 21) {
            state.pHands[0].isDone = true;
            state.status = 'ended';
        }
    } else {
        if (!token) { res.status(400); throw new Error('Sesión no encontrada'); }
        try {
            state = decryptState(token);
        } catch (e) {
            res.status(400); throw new Error('Sesión inválida o manipulada. Empieza de nuevo.');
        }

        // 🔥 VALIDACIÓN ANTI-TRAMPAS (REPLAY ATTACK)
        const currentUser = await User.findById(req.user._id).select('activeGameToken');
        if (!currentUser.activeGameToken || currentUser.activeGameToken !== state.gameId) {
            res.status(400); 
            throw new Error('Partida expirada o intento de trampa detectado. Empieza de nuevo.');
        }

        let hand = state.pHands[state.activeHand];

        if (action === 'hit') {
            hand.cards.push(state.deck.pop());
            if (calcScore(hand.cards) > 21) hand.isDone = true;
        } else if (action === 'stand') {
            hand.isDone = true;
        } else if (action === 'double') {
            await chargeAndValidate(req.user._id, hand.bet);
            hand.bet *= 2; hand.isDoubled = true; hand.isDone = true;
            hand.cards.push(state.deck.pop());
        }

        // Check if next hand exists
        const nextIdx = state.pHands.findIndex(h => !h.isDone);
        if (nextIdx !== -1) {
            state.activeHand = nextIdx;
        } else {
            state.status = 'ended';
        }
    }

    let finalUser = req.user;
    let totalPayout = 0;

    // Si termina, juega el dealer y paga
    if (state.status === 'ended') {
        const allBusted = state.pHands.every(h => calcScore(h.cards) > 21);
        if (!allBusted) {
            while (calcScore(state.dHand) < 17) state.dHand.push(state.deck.pop());
        }

        const dScore = calcScore(state.dHand);
        state.pHands.forEach(h => {
            const pScore = calcScore(h.cards);
            if (pScore <= 21) {
                if (dScore > 21 || pScore > dScore) {
                    if (pScore === 21 && h.cards.length === 2 && !h.isDoubled && state.pHands.length === 1) totalPayout += h.bet * 2.5;
                    else totalPayout += h.bet * 2;
                } else if (pScore === dScore) {
                    totalPayout += h.bet;
                }
            }
        });

        // 🔥 PAGAR Y ROMPER EL CANDADO EN UNA SOLA CONSULTA
        if (totalPayout > 0) {
            finalUser = await User.findByIdAndUpdate(
                req.user._id, 
                { $inc: { gameCoins: totalPayout }, $set: { activeGameToken: null } }, 
                { new: true }
            );
        } else {
            finalUser = await User.findByIdAndUpdate(
                req.user._id, 
                { $set: { activeGameToken: null } }, 
                { new: true }
            );
        }
    }

    const newStateToken = state.status === 'ended' ? null : encryptState(state);

    // Ocultar segunda carta del dealer si no ha terminado
    const safeDHand = state.status === 'ended' ? state.dHand : [state.dHand[0], { hidden: true }];

    res.json({
        state: { pHands: state.pHands, dHand: safeDHand, activeHand: state.activeHand, status: state.status, payout: totalPayout },
        token: newStateToken,
        user: finalUser
    });
});

module.exports = { playDice, playScratch, playSlots, playRoulette, playFortuneWheel, playBlackjack };