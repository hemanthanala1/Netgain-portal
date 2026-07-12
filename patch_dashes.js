const fs = require('fs');

const files = [
    'lib/pdf-template.tsx', 
    'app/(dashboard)/documents/quotations/page.tsx', 
    'app/(dashboard)/documents/invoices/page.tsx', 
    'app/(dashboard)/documents/agreements/page.tsx', 
    'app/(dashboard)/documents/sow/page.tsx'
];

files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    let original = c;

    // Replace the specific UTF-8 sequences that get corrupted
    // using Unicode escapes to be safe
    c = c.replace(/\u00E2\u20AC\u201D/g, '-'); // â€” -> -
    c = c.replace(/\u00E2\u20AC\u201C/g, '-'); // â€“ -> -
    c = c.replace(/\u2014/g, '-'); // em dash
    c = c.replace(/\u2013/g, '-'); // en dash
    c = c.replace(/—/g, '-');
    c = c.replace(/–/g, '-');

    if (c !== original) {
        console.log('Fixed dashes in', f);
        fs.writeFileSync(f, c, 'utf8');
    }
});
