const crypto = require('crypto');

// 1. User Agent Parser Test
function parseUserAgent(ua) {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let device = 'Desktop';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';

  if (ua.includes('Mobi') || ua.includes('Android') || ua.includes('iPhone')) device = 'Mobile';
  else if (ua.includes('iPad')) device = 'Tablet';

  return { browser, os, device };
}

// 2. Hash Calculation Test
function calculateDocumentHash(record) {
  const docString = JSON.stringify(record);
  return crypto.createHash('sha256').update(docString).digest('hex');
}

// 3. Verification ID Generation Test
function generateVerificationId() {
  const randomBytes = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CERT-${randomBytes.slice(0, 4)}-${randomBytes.slice(4, 8)}-${randomBytes.slice(8, 12)}`;
}

// Running Tests
function runTests() {
  console.log('============================================================');
  console.log('E-SIGNATURE LOGIC UNIT TESTS');
  console.log('============================================================');

  // Test UA Parser
  console.log('\n--- 1. Testing User Agent Parser ---');
  const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  
  const parsedChrome = parseUserAgent(chromeUA);
  const parsedIPhone = parseUserAgent(iphoneUA);

  console.log('Chrome User Agent:', parsedChrome);
  console.log('iPhone User Agent:', parsedIPhone);

  if (parsedChrome.os === 'Windows' && parsedChrome.browser === 'Chrome' && parsedChrome.device === 'Desktop') {
    console.log('✅ Chrome UA parsed correctly!');
  } else {
    console.error('❌ Chrome UA parsing FAILED!');
  }

  if (parsedIPhone.os === 'iOS' && parsedIPhone.browser === 'Safari' && parsedIPhone.device === 'Mobile') {
    console.log('✅ iPhone UA parsed correctly!');
  } else {
    console.error('❌ iPhone UA parsing FAILED!');
  }

  // Test Hash Calculation
  console.log('\n--- 2. Testing Document Hash Generation ---');
  const mockDoc = { id: 'sow-123', client: 'Acme Corp', value: 15000, timeline: '2 months', version: 1 };
  const hash1 = calculateDocumentHash(mockDoc);
  console.log('Document Hash:', hash1);
  
  const mockDocChanged = { ...mockDoc, value: 20000 };
  const hash2 = calculateDocumentHash(mockDocChanged);
  console.log('Modified Document Hash:', hash2);

  if (hash1 !== hash2) {
    console.log('✅ Document hash detects modifications correctly!');
  } else {
    console.error('❌ Hash calculation FAILED to detect modifications!');
  }

  // Test Verification ID Generator
  console.log('\n--- 3. Testing Verification Certificate ID Generation ---');
  const verId = generateVerificationId();
  console.log('Generated Certificate ID:', verId);

  const verIdRegex = /^CERT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (verIdRegex.test(verId)) {
    console.log('✅ Certificate ID follows the required CERT-XXXX-XXXX-XXXX format!');
  } else {
    console.error('❌ Certificate ID format FAILED validation!');
  }

  console.log('\n============================================================');
  console.log('ALL UNIT TESTS COMPLETED');
  console.log('============================================================\n');
}

runTests();
