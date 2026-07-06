import fs from 'fs';
import path from 'path';

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const newContent = content.replace(/= aria-label="([^"]+)">/g, '=>');
  if (newContent !== content) {
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated ${filePath}`);
  }
}

traverse('c:\\Users\\heman\\Downloads\\Netgain Operating Portal\\Netgain-portal\\app\\(dashboard)');
