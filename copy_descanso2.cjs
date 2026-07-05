const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\grd_a\\.gemini\\antigravity\\brain\\23843030-28fb-4e59-a203-4c4b02542117';
const destDir = path.join(__dirname, 'public', 'assets', 'descanso');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const filesToCopy = [
  { src: 'movilidad_protocolo_1780883626980.png', dest: 'movilidad.png' }, // The real movilidad image
  { src: 'natacion_terapia_1780883638151.png', dest: 'natacion.png' }
];

filesToCopy.forEach(f => {
  const sourceFile = path.join(srcDir, f.src);
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, path.join(destDir, f.dest));
    console.log(`Copied ${f.dest}`);
  } else {
    console.log(`File not found: ${sourceFile}`);
  }
});
