const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\grd_a\\.gemini\\antigravity\\brain\\23843030-28fb-4e59-a203-4c4b02542117';
const destDir = path.join(__dirname, 'public', 'assets', 'descanso');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const filesToCopy = [
  { src: 'caminata_regenerativa_1780883606240.png', dest: 'caminata.png' },
  { src: 'bicicleta_flush_1780883616378.png', dest: 'bicicleta.png' },
  { src: 'descanso_absoluto_1780883649799.png', dest: 'movilidad.png' }, // using this for movilidad for now
  { src: 'hub_descanso_activo_banner_1780885641519.png', dest: 'banner.png' }
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
