const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.jsx') || dirPath.endsWith('.ts')) {
        callback(dirPath);
      }
    }
  });
}

const targets = [
  path.join(__dirname, 'app', '(dashboard)'),
  path.join(__dirname, 'app', 'client-portal'),
  path.join(__dirname, 'components')
];

let tablesModified = 0;
let gridsModified = 0;

targets.forEach(dir => {
  if (fs.existsSync(dir)) {
    walkDir(dir, function(filePath) {
      let content = fs.readFileSync(filePath, 'utf-8');
      let originalContent = content;

      // Fix Tables
      content = content.replace(/<table\s+className="([^"]+)"/g, (match, classNames) => {
        if (classNames.includes('w-full') && !classNames.includes('min-w-')) {
          tablesModified++;
          return `<table className="${classNames} min-w-[700px]"`;
        }
        return match;
      });
      content = content.replace(/<table\s+className=\{`([^`]+)`\}/g, (match, classNames) => {
        if (classNames.includes('w-full') && !classNames.includes('min-w-')) {
          tablesModified++;
          return `<table className={\`${classNames} min-w-[700px]\`}`;
        }
        return match;
      });

      // Fix Grids
      content = content.replace(/(?<!:)\bgrid-cols-([2-9])\b/g, (match, num) => {
        gridsModified++;
        return `grid-cols-1 md:grid-cols-${num}`;
      });
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
      }
    });
  }
});

console.log(`Done! Modified ${tablesModified} tables and ${gridsModified} grid layouts.`);
