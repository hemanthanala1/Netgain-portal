const fs = require('fs');

const fixFile = (path) => {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/<LineItemsTable\s*variant="simple"/g, '<LineItemsTable variant="detailed"');
  fs.writeFileSync(path, content);
};

fixFile('app/(dashboard)/documents/invoices/page.tsx');
fixFile('app/(dashboard)/documents/quotations/page.tsx');
console.log('Replaced variant="simple" with variant="detailed"');
