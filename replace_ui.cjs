const fs = require('fs');

const replaceInFile = (file, replacements) => {
  let content = fs.readFileSync(file, 'utf8');
  for (let r of replacements) {
    content = content.replace(r.regex, r.replacement);
  }
  fs.writeFileSync(file, content);
  console.log(`Replaced in ${file}`);
};

// MiRutina.jsx
replaceInFile('src/pages/MiRutina.jsx', [
  { regex: /Tu Nivel/g, replacement: "Tu Madera" },
  { regex: /Ciclo de nivel:/g, replacement: "Ciclo de madera:" },
  { regex: /Cambiar Rutina/g, replacement: "Cambiar Misión" },
  { regex: /Nivel <strong>/g, replacement: "Madera <strong>" },
  { regex: /\+ Crear Rutina Personalizada/g, replacement: "+ Crear Misión Personalizada" },
  { regex: /Rutina de Regalo/g, replacement: "Misión de Regalo" },
  { regex: /Tu entrenador aún no ha programado tus rutinas/g, replacement: "Tu Coach Vigor aún no ha programado tus misiones" },
  { regex: /Tu entrenador/g, replacement: "Tu Coach Vigor" },
  { regex: /\|\| 'Rutina'/g, replacement: "|| 'Misión'" },
  { regex: /Quiero mi rutina de entrenamiento/g, replacement: "Quiero mi misión de entrenamiento" },
  { regex: /Con el plan gratuito solo puedes crear 1 rutina/g, replacement: "Con el plan gratuito solo puedes crear 1 misión" },
  { regex: /para crear rutinas ilimitadas/g, replacement: "para crear misiones ilimitadas" },
  { regex: /para ver mi Rutina/g, replacement: "para ver mi Misión" }
]);

// CuestionarioModal.jsx
replaceInFile('src/components/CuestionarioModal.jsx', [
  { regex: /Quiero mi rutina de entrenamiento/g, replacement: "Quiero mi misión de entrenamiento" },
  { regex: /rutinas de nivel/g, replacement: "misiones de madera" }
]);

// OnboardingModal.jsx
replaceInFile('src/components/OnboardingModal.jsx', [
  { regex: /seguir rutinas/g, replacement: "cumplir misiones" }
]);

// LegalModals.jsx
replaceInFile('src/components/LegalModals.jsx', [
  { regex: /niveles de entrenamiento/g, replacement: "maderas de entrenamiento" },
  { regex: /asignación de niveles/g, replacement: "asignación de maderas" }
]);

// AsignarRutina.jsx and AsignarRutinaMasiva.jsx
replaceInFile('src/pages/AsignarRutina.jsx', [
  { regex: /Asignar Rutina/g, replacement: "Asignar Misión" },
  { regex: /Buscar rutinas/g, replacement: "Buscar misiones" },
  { regex: /No se encontraron rutinas/g, replacement: "No se encontraron misiones" }
]);
replaceInFile('src/pages/AsignarRutinaMasiva.jsx', [
  { regex: /Asignar Rutina/g, replacement: "Asignar Misión" },
  { regex: /Buscar rutinas/g, replacement: "Buscar misiones" },
  { regex: /No se encontraron rutinas/g, replacement: "No se encontraron misiones" },
  { regex: /clientes/g, replacement: "atletas" },
  { regex: /Clientes/g, replacement: "Atletas" }
]);

// PanelEntrenador.jsx
replaceInFile('src/pages/PanelEntrenador.jsx', [
  { regex: /Mis Clientes/g, replacement: "Mis Atletas" },
  { regex: /Total Clientes/g, replacement: "Total Atletas" },
  { regex: /Agregar Cliente/g, replacement: "Agregar Atleta" },
  { regex: /Nuevo Cliente/g, replacement: "Nuevo Atleta" },
  { regex: /Email del Cliente/g, replacement: "Email del Atleta" },
  { regex: /El cliente debe registrarse/g, replacement: "El atleta debe registrarse" },
  { regex: /cliente ha sido añadido/g, replacement: "atleta ha sido añadido" },
  { regex: /No tienes clientes asignados/g, replacement: "No tienes atletas asignados" },
  { regex: /Invita a tu primer cliente/g, replacement: "Invita a tu primer atleta" },
  { regex: /Ver Progreso del Cliente/g, replacement: "Ver Progreso del Atleta" }
]);

// PaywallCoach.jsx and Paywall.jsx
replaceInFile('src/pages/PaywallCoach.jsx', [
  { regex: /alumnos/g, replacement: "atletas" }
]);
replaceInFile('src/pages/Perfil.jsx', [
  { regex: /alumnos/g, replacement: "atletas" }
]);
