const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.resolve('dist/resuloto-app');

if (!fs.existsSync(outputDir)) {
  throw new Error(`No existe el directorio de salida: ${outputDir}`);
}

for (const file of fs.readdirSync(outputDir)) {
  if (!file.startsWith('_')) continue;
  fs.renameSync(path.join(outputDir, file), path.join(outputDir, file.slice(1)));
}

for (const file of ['importmap.json', 'remoteEntry.json']) {
  const filePath = path.join(outputDir, file);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const normalize = value => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]));
    }
    return typeof value === 'string' && value.startsWith('_') ? value.slice(1) : value;
  };
  fs.writeFileSync(filePath, `${JSON.stringify(normalize(json), null, 2)}\n`);
}
