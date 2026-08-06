const fs = require('fs');

const replaceInFile = (file, replacements) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    for (let r of replacements) {
      content = content.replace(r.regex, r.replacement);
    }
    fs.writeFileSync(file, content);
    console.log(`Replaced in ${file}`);
  }
};

// AdminRetos.jsx
replaceInFile('src/components/AdminRetos.jsx', [
  { regex: /rutinas/g, replacement: "misiones" }
]);

// RutinaDetail.jsx
replaceInFile('src/pages/RutinaDetail.jsx', [
  { regex: /Rutina completada/g, replacement: "Misión completada" },
  { regex: /Terminar Rutina/g, replacement: "Terminar Misión" },
  { regex: /Rutina de Entrenamiento/g, replacement: "Misión de Entrenamiento" }
]);

// AdminGestorSistemas.jsx
replaceInFile('src/components/AdminGestorSistemas.jsx', [
  { regex: /CONSTRUCTOR DE LA RUTINA/g, replacement: "CONSTRUCTOR DE LA MISIÓN" },
  { regex: /Volver a Rutinas/g, replacement: "Volver a Misiones" },
  { regex: /Ejercicios en esta Rutina/g, replacement: "Ejercicios en esta Misión" },
  { regex: /Rutina vacía/g, replacement: "Misión vacía" },
  { regex: /Solo esta Rutina/g, replacement: "Solo esta Misión" },
  { regex: /todas las rutinas/g, replacement: "todas las misiones" }
]);

// Historial.jsx
replaceInFile('src/pages/Historial.jsx', [
  { regex: /No tienes rutinas/g, replacement: "No tienes misiones" },
  { regex: /Historial de Rutinas/g, replacement: "Historial de Misiones" }
]);
