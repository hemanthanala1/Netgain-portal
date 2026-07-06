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

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('<Button') && line.includes('size="icon"') && !line.includes('aria-label')) {
      let label = "Action";
      if (line.includes('title=')) {
        const match = line.match(/title="([^"]+)"/);
        if (match) label = match[1];
      } else if (line.includes('<Eye')) label = "View";
      else if (line.includes('<Edit') || line.includes('<Pencil')) label = "Edit";
      else if (line.includes('<Trash')) label = "Delete";
      else if (line.includes('<Download')) label = "Download";
      else if (line.includes('<ExternalLink')) label = "External Link";
      else if (line.includes('<Plus')) label = "Add";
      else if (line.includes('setGridView')) label = "Toggle View";
      
      lines[i] = line.replace('size="icon"', `size="icon" aria-label="${label}"`);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Updated ${filePath}`);
  }
}

traverse('c:\\Users\\heman\\Downloads\\Netgain Operating Portal\\Netgain-portal\\app\\(dashboard)');
