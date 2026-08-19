const User = require('../models/User');

/**
 * ¿Puede `viewer` ver el contenido de `owner`?
 *
 * Vivía dentro de socialController. Se saca aquí porque el gimnasio también lo
 * necesita (para copiar el entreno de otra persona a tus rutinas) y tener DOS
 * copias de una comprobación de privacidad es la forma segura de que un día una
 * se quede atrás y se filtre algo.
 */
const canViewContent = async (viewerId, ownerId) => {
    if (viewerId.toString() === ownerId.toString()) return true;

    const owner = await User.findById(ownerId).select('isPrivate friends');
    if (!owner) return false;
    if (!owner.isPrivate) return true;

    return (owner.friends || []).some(f => f.toString() === viewerId.toString());
};

const SECTION_KEYS = { workouts: 'workouts', food: 'food', missions: 'missions', body: 'body' };

/** ¿Y esa SECCIÓN en concreto? (cada usuario puede ocultarlas por separado) */
const canViewSection = async (viewerId, ownerId, section) => {
    if (viewerId.toString() === ownerId.toString()) return true;
    if (!(await canViewContent(viewerId, ownerId))) return false;

    const key = SECTION_KEYS[section];
    if (!key) return true;

    const owner = await User.findById(ownerId).select('visibility').lean();
    // Sin campo (cuentas antiguas) se considera visible
    return owner?.visibility?.[key] !== false;
};

module.exports = { canViewContent, canViewSection, SECTION_KEYS };
