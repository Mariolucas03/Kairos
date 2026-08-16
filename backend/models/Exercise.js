const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    // Campos básicos
    name: { type: String, required: true },
    // Grupo muscular (Pecho, Espalda...). Es la clave con la que agregan las
    // estadísticas, así que SIEMPRE guarda un grupo, nunca un músculo concreto.
    muscle: { type: String, required: true },
    // Músculo concreto elegido en modo PRO (ej: 'Dorsal ancho'). Opcional:
    // en modo normal se queda vacío y todo sigue funcionando igual.
    muscleDetail: { type: String, default: '' },
    // Otros GRUPOS que participan en el ejercicio. Se usan para colorear el
    // mapa del cuerpo con menos intensidad que el músculo principal.
    secondary: { type: [String], default: [] },
    // Reparto del esfuerzo por músculo, en porcentaje: { 'Glúteo mayor': 35, ... }.
    // Es lo que permite que una sentadilla no sume lo mismo al cuádriceps que al
    // lumbar. Si está vacío se usa el reparto antiguo (principal 100%, cada
    // secundario 40%), así que los ejercicios viejos siguen funcionando.
    shares: { type: Map, of: Number, default: undefined },
    // Los de cardio puntúan por duración, no por kg levantados
    isCardio: { type: Boolean, default: false },
    equipment: { type: String, default: "Barra" },
    // Familia de equipamiento ('Pesas', 'Máquina', 'Polea'...). Es el segundo
    // nivel del selector: dentro de un grupo muscular hay hasta 245 ejercicios.
    equipmentGroup: { type: String, default: 'Otros' },

    // --- DEMOSTRACIÓN VISUAL (catálogo de GIFs) ---
    // ⚠️ Sin declarar aquí, mongoose en modo strict los descarta EN SILENCIO al
    // guardar, que es justo lo que pasó antes con `photo` y `type` en las series.

    // Identificador estable del ejercicio en el catálogo externo. Es la clave de
    // sincronización: el nombre puede cambiar de redacción, el slug no.
    slug: { type: String, default: null },
    // GIF de ejecución y miniatura estática. Se sirven desde el CDN de jsDelivr,
    // no se guardan en el repositorio ni en la base de datos.
    gif: { type: String, default: '' },
    thumb: { type: String, default: '' },
    // Pasos de ejecución, tal cual vienen del catálogo
    instructions: { type: [String], default: [] },
    // Zona del cuerpo ('arms', 'legs'...). Informativo, para agrupar y filtrar.
    bodyPart: { type: String, default: '' },
    // Los 82 ejercicios de siempre. El selector los muestra por defecto, porque
    // una lista plana de 1291 no hay quien la use.
    isCore: { type: Boolean, default: false },

    // --- NUEVOS CAMPOS NECESARIOS PARA EL FIX ---

    // Vinculación con usuario (para que cada uno tenga sus propios ejercicios si quiere)
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Categoría (Fuerza, Cardio, etc)
    category: {
        type: String,
        default: 'strength'
    },

    // Si es un ejercicio creado por el sistema o por el usuario
    isCustom: {
        type: Boolean,
        default: false
    }
});

// Índice compuesto: Permite buscar rápido ejercicios por nombre para un usuario específico
exerciseSchema.index({ name: 1, user: 1 });
// El selector pide por grupo y prioriza los del catálogo base
exerciseSchema.index({ muscle: 1, isCore: -1, name: 1 });

module.exports = mongoose.model('Exercise', exerciseSchema);