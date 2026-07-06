import fs from 'fs';
import path from 'path';

const filesToUpdate = [
  'campaign-strategy/page.tsx',
  'marketing/page.tsx',
  'prd/page.tsx',
  'projects/page.tsx',
  'services/page.tsx',
  'team/page.tsx'
];

const basePath = 'c:\\Users\\heman\\Downloads\\Netgain Operating Portal\\Netgain-portal\\app\\(dashboard)\\';

for (const relPath of filesToUpdate) {
  const fullPath = path.join(basePath, relPath);
  let content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('size="icon"') && !lines[i].includes('aria-label') && !lines[i].includes('<Button')) {
      lines[i] = lines[i].replace('size="icon"', 'size="icon" aria-label="Action"');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, lines.join('\n'));
    console.log(`Updated ${fullPath}`);
  }
}
