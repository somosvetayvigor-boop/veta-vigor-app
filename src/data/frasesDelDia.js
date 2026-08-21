// Frases de filosofía V&V, una por día (rota por día del año). Extraídas de
// MiRutina.jsx (renderFraseDelDia) para poder reusarlas también en el
// widget de pantalla de inicio (src/utils/widgetBridge.js) sin duplicar la
// lista en dos lugares.
export const FRASES_DEL_DIA = [
  { text: "Raíces Profundas: Antes de intentar elevarte, asegúrate de que tu base sea inquebrantable. Toda gran estructura comienza desde el suelo.", author: "Filosofía V&V" },
  { text: "La Veta del Carácter: Así como la madera revela su historia y resistencia en sus vetas, tu cuerpo y tu mente reflejan la disciplina inquebrantable de tus hábitos.", author: "Filosofía V&V" },
  { text: "Estructura Interna Oculta: La verdadera fuerza no siempre se ve por fuera. Se sostiene sobre tendones reforzados, articulaciones sanas y una voluntad de acero que soporta cualquier carga.", author: "Filosofía V&V" },
  { text: "Progreso Orgánico: El crecimiento real toma tiempo y consistencia, igual que un árbol fuerte. No hay atajos para la verdadera maestría.", author: "Filosofía V&V" },
  { text: "Solidez Estructural: Cuida tu postura en cada repetición. Un cuerpo correctamente alineado es capaz de soportar y generar fuerzas extraordinarias.", author: "Filosofía V&V" },
  { text: "Resiliencia ante la Fricción: El roce, la resistencia y el esfuerzo constante no te desgastan; son las herramientas que pulen tu mejor versión.", author: "Filosofía V&V" },
  { text: "El Poder del Reposo: El descanso no es debilidad. Es el espacio necesario donde las fibras se reparan y la fuerza se asienta.", author: "Filosofía V&V" },
  { text: "Fuerza Natural: Tu propio cuerpo es la máquina más sofisticada que existe. Domínalo por completo antes de buscar cargas externas.", author: "Filosofía V&V" },
  { text: "Vigor Inagotable: La verdadera fuerza no es un estallido momentáneo de energía, es la capacidad de sostener el esfuerzo día tras día.", author: "Filosofía V&V" },
  { text: "Gravedad como Maestra: No luches contra la gravedad; úsala a tu favor para esculpir tu fuerza y desafiar tus propios límites.", author: "Filosofía V&V" },
  { text: "Consistencia de Roble: Preséntate a entrenar incluso en los días donde la motivación escasea. El vigor se construye cuando la disciplina supera a la pereza.", author: "Filosofía V&V" },
  { text: "Forjando el Núcleo: Toda la fuerza de tus extremidades nace de un centro (core) estable y poderoso. Trabaja tu centro como el tronco que sostiene tus ramas.", author: "Filosofía V&V" },
  { text: "Vencer la Resistencia: Cada punto de estancamiento, cada repetición que falla, es simplemente el paso previo a romper tu límite anterior.", author: "Filosofía V&V" },
  { text: "Sin Excusas, Sin Adornos: Tu cuerpo, el suelo y unas barras son todo lo que necesitas. La simplicidad del entorno exige la máxima complejidad del esfuerzo.", author: "Filosofía V&V" },
  { text: "Conexión Mente-Músculo: El movimiento perfecto nace cuando la intención de tu mente y la contracción de tus fibras son una sola entidad.", author: "Filosofía V&V" },
  { text: "Calidad sobre Cantidad: Una repetición ejecutada con técnica impecable y control absoluto vale más que diez hechas con pura inercia.", author: "Filosofía V&V" },
  { text: "Tensión Isométrica: Aprende a encontrar el poder absoluto en la quietud. Sostener tu cuerpo en el espacio requiere un control mental tan fuerte como el físico.", author: "Filosofía V&V" },
  { text: "Simetría y Equilibrio: Busca siempre la armonía en tu entrenamiento. Equilibra la tensión y la relajación, el empuje y el tirón, la mente y el músculo.", author: "Filosofía V&V" },
  { text: "Fluidez del Movimiento: El objetivo final de la calistenia es que lo increíblemente difícil se vea suave y natural, como si el esfuerzo no existiera.", author: "Filosofía V&V" },
  { text: "Adaptabilidad Constante: Si un ángulo es demasiado exigente, ajusta la palanca, respira y vuelve a intentar. Sé flexible en el método, pero rígido en la meta.", author: "Filosofía V&V" },
  { text: "Legado en Movimiento: No entrenes solo para la foto de hoy. Entrena con Veta y Vigor para que tu cuerpo te responda con poder, movilidad y libertad el resto de tu vida.", author: "Filosofía V&V" }
];

/** Misma frase para todo el día, para toda la app (rota por día del año). */
export function getFraseDelDia() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  return FRASES_DEL_DIA[dayOfYear % FRASES_DEL_DIA.length];
}
