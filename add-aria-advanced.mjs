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

  // Find all <Button tags
  const newContent = content.replace(/<Button\b([^>]*?)>/g, (match, attrs) => {
    if (attrs.includes('size="icon"') && !attrs.includes('aria-label=')) {
      changed = true;
      let label = "Action";
      if (attrs.includes('title=')) {
        const titleMatch = attrs.match(/title="([^"]+)"/);
        if (titleMatch) label = titleMatch[1];
      } else if (match.includes('Trash') || attrs.includes('destructive')) label = 'Delete';
      else if (match.includes('Edit')) label = 'Edit';
      
      return `<Button${attrs} aria-label="${label}">`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated ${filePath}`);
  }
}

traverse('c:\\Users\\heman\\Downloads\\Netgain Operating Portal\\Netgain-portal\\app\\(dashboard)');
