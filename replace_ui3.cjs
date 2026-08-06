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

replaceInFile('src/components/AdminGestorSistemas.jsx', [
  { regex: /Guardar Cambios/g, replacement: "Registrar Cambios" }
]);

replaceInFile('src/pages/AsignarRutina.jsx', [
  { regex: /Guardando\.\.\./g, replacement: "Registrando..." },
  { regex: /Guardar y Asignar Calendario/g, replacement: "Registrar y Asignar Calendario" }
]);

replaceInFile('src/pages/AsignarRutinaMasiva.jsx', [
  { regex: /Guardando\.\.\./g, replacement: "Registrando..." },
  { regex: /Guardar y Asignar Calendario/g, replacement: "Registrar y Asignar Calendario" }
]);

replaceInFile('src/pages/CreadorRutinas.jsx', [
  { regex: /Guardar Rutina/gi, replacement: "Registrar Misión" },
  { regex: /Rutina/g, replacement: "Misión" },
  { regex: /rutina/g, replacement: "misión" },
  { regex: /rutinas/g, replacement: "misiones" }
]);

replaceInFile('src/pages/Perfil.jsx', [
  { regex: /Guardar Cambios/g, replacement: "Registrar Cambios" },
  { regex: /Guardar Contraseña/g, replacement: "Registrar Contraseña" },
  { regex: /Guardando\.\.\./g, replacement: "Registrando..." }
]);

replaceInFile('src/pages/RutinaDetail.jsx', [
  { regex: /Guardar Récord/g, replacement: "Registrar Récord" }
]);

replaceInFile('src/pages/Login.jsx', [
  { regex: /Guardar Nueva Contraseña/g, replacement: "Registrar Nueva Contraseña" }
]);
