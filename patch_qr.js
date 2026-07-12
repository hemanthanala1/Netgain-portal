const fs = require('fs');

// 1. Patch lib/pdf-generator-server.ts
let c = fs.readFileSync('lib/pdf-generator-server.ts', 'utf8');
c = c.replace(
  /if \(bank\.upiId\)\s+bankLines\.push\(`- \*\*UPI:\*\* \$\{bank\.upiId\}`\)/,
  `if (bank.upiId) {
      bankLines.push(\`- **UPI:** \${bank.upiId}\`);
      const qrSrc = \`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=\${encodeURIComponent(\`upi://pay?pa=\${bank.upiId}&pn=\${encodeURIComponent(company.name)}\`)}\`;
      bankLines.push(\`__QR_CODE__\${qrSrc}__\`);
    }`
);
fs.writeFileSync('lib/pdf-generator-server.ts', c);

// 2. Patch lib/pdf-template.tsx
let c2 = fs.readFileSync('lib/pdf-template.tsx', 'utf8');
c2 = c2.replace(
  /if \(textLine\.startsWith\('# '\)\) \{\s*textStyle = \{ \.\.\.textStyle, fontSize: \(style\?\.fontSize \|\| 10\) \+ 4, fontWeight: 'bold', marginTop: 8 \};\s*textLine = textLine\.replace\('# ', ''\);\s*\}/,
  `if (textLine.startsWith('# ')) {
          textStyle = { ...textStyle, fontSize: (style?.fontSize || 10) + 4, fontWeight: 'bold', marginTop: 8 };
          textLine = textLine.replace('# ', '');
        }

        if (textLine.startsWith('__QR_CODE__')) {
          const qrUrl = textLine.replace('__QR_CODE__', '').replace('__', '');
          return (
            <View key={i} style={{ marginTop: 10, marginBottom: 10 }}>
              <Image src={qrUrl} style={{ width: 100, height: 100 }} />
            </View>
          );
        }`
);
fs.writeFileSync('lib/pdf-template.tsx', c2);

console.log("Patched successfully");
