const fs = require('fs');
const path = require('path');

// Carpetas a ignorar (IMPORTANTE para que no pese 500MB)
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.vscode', 'uploads'];
const ignoreFiles = ['package-lock.json', 'yarn.lock', '.env', '.DS_Store'];
const extensions = ['.js', '.jsx', '.css', '.json', '.html']; // Archivos que nos interesan

// Archivo de salida
const outputFile = 'PROYECTO_COMPLETO.txt';

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      if (!ignoreDirs.includes(file)) {
        arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
      }
    } else {
      if (!ignoreFiles.includes(file) && extensions.includes(path.extname(file))) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const allFiles = getAllFiles(__dirname);
let content = "";

allFiles.forEach(file => {
    // Ignorar el propio script y el output
    if (file.includes('contexto.js') || file.includes(outputFile)) return;

    try {
        const data = fs.readFileSync(file, 'utf8');
        content += `\n\n--- INICIO DE ARCHIVO: ${file} ---\n\n`;
        content += data;
        content += `\n\n--- FIN DE ARCHIVO: ${file} ---\n`;
    } catch (e) {
        console.log(`No se pudo leer: ${file}`);
    }
});

fs.writeFileSync(outputFile, content);
console.log(`✅ ¡Listo! Sube el archivo "${outputFile}" al chat.`);