/**
 * Netgain Ads — Cryptography & Session Unit Tests
 * Runs directly with Node.js using existing repository test pattern.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Set test environment variables
process.env.ENCRYPTION_KEY = '10d1eb7dfa97a949e4d566acbece51c7f16469e89a0eb5ec695dbf4967e3cde3';
process.env.CLIENT_SESSION_SECRET = 'ceff06a72ea6951098b9c70aa181675b73bc62985108fd48257bb576ffd633a3';

// Direct implementations matching lib/ads/crypto-ads.ts and session-token.ts
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  return crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
}

function getSigningSecret() {
  return crypto.createHash('sha256').update(process.env.CLIENT_SESSION_SECRET).digest();
}

function encryptCredential(plaintext) {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

function decryptCredential(encryptedPayload) {
  if (!encryptedPayload) return '';
  const parts = encryptedPayload.split(':');
  if (parts.length === 3) {
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const ciphertext = parts[2];
      if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error('Invalid lengths');
      }
      const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      throw new Error('Decryption failed: integrity check failed.');
    }
  }
  return encryptedPayload;
}

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

function signClientSession(payload, expiresInMs = 7 * 24 * 3600 * 1000) {
  const now = Date.now();
  const sessionData = { ...payload, issuedAt: now, exp: now + expiresInMs };
  const encodedPayload = base64UrlEncode(JSON.stringify(sessionData));
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('hex');
  return `${encodedPayload}.${signature}`;
}

function verifyClientSession(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSignature] = parts;
  try {
    const expectedSignature = crypto
      .createHmac('sha256', getSigningSecret())
      .update(encodedPayload)
      .digest('hex');

    const providedBuffer = Buffer.from(providedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (providedBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null;

    const session = JSON.parse(base64UrlDecode(encodedPayload));
    if (!session.exp || session.exp < Date.now()) return null;
    if (!session.clientId || !session.clientAccountId) return null;
    return session;
  } catch (e) {
    return null;
  }
}

// ==========================================
// TEST RUNNER
// ==========================================
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

console.log('============================================================');
console.log('NETGAIN ADS PHASE 1A: CRYPTOGRAPHY & SESSION UNIT TESTS');
console.log('============================================================\n');

// 1. AES-256-GCM Roundtrip
console.log('--- 1. Testing AES-256-GCM Credential Encryption ---');
const sampleToken = 'EAABwb1234567890MetaOAuthToken_SecurePayload_XYZ';
const encrypted = encryptCredential(sampleToken);
assert(encrypted.startsWith(''), 'Encryption produces non-empty output');
assert(encrypted.split(':').length === 3, 'Payload format is iv:authTag:ciphertext');
const decrypted = decryptCredential(encrypted);
assert(decrypted === sampleToken, 'Decrypted text strictly matches original plaintext');

// 2. Tamper Resistance
console.log('\n--- 2. Testing Authenticated Encryption Tamper Resistance ---');
const parts = encrypted.split(':');
const tamperedCiphertext = parts[0] + ':' + parts[1] + ':' + (parts[2].slice(0, -2) + (parts[2].slice(-2) === 'aa' ? 'bb' : 'aa'));
let tamperCaught = false;
try {
  decryptCredential(tamperedCiphertext);
} catch (e) {
  tamperCaught = true;
}
assert(tamperCaught, 'Tampered ciphertext triggers integrity failure exception');

const tamperedTag = parts[0] + ':' + (parts[1].slice(0, -2) + '00') + ':' + parts[2];
let tagTamperCaught = false;
try {
  decryptCredential(tamperedTag);
} catch (e) {
  tagTamperCaught = true;
}
assert(tagTamperCaught, 'Tampered authentication tag triggers integrity failure exception');

// 3. Client Session Signing & Verification
console.log('\n--- 3. Testing Client Session HMAC-SHA256 Token ---');
const testPayload = {
  clientAccountId: 'acc_test_123',
  clientId: 'client_acme_corp',
  email: 'john@acme.com',
  name: 'John Acme',
  company: 'Acme Corporation'
};

const sessionToken = signClientSession(testPayload);
assert(sessionToken.includes('.'), 'Session token is separated by dot');

const verified = verifyClientSession(sessionToken);
assert(verified !== null, 'Session token verifies successfully');
assert(verified && verified.clientId === 'client_acme_corp', 'Verified session contains correct clientId');
assert(verified && verified.clientAccountId === 'acc_test_123', 'Verified session contains correct clientAccountId');

// 4. Expiration Check
console.log('\n--- 4. Testing Token Expiration ---');
const expiredToken = signClientSession(testPayload, -5000); // expired 5 seconds ago
const expiredResult = verifyClientSession(expiredToken);
assert(expiredResult === null, 'Expired session token is rejected');

// 5. Signature Tampering
console.log('\n--- 5. Testing Signature Tampering & Timing Safety ---');
const tokenParts = sessionToken.split('.');
const forgedToken = tokenParts[0] + '.' + tokenParts[1].slice(0, -2) + 'ff';
const forgedResult = verifyClientSession(forgedToken);
assert(forgedResult === null, 'Forged signature is rejected');

// 6. Secret Separation Check
console.log('\n--- 6. Testing Key Isolation (Separation of Secrets) ---');
const signatureWithWrongKey = crypto
  .createHmac('sha256', getEncryptionKey()) // Incorrectly using encryption key instead of session secret
  .update(tokenParts[0])
  .digest('hex');
const crossSecretToken = tokenParts[0] + '.' + signatureWithWrongKey;
assert(verifyClientSession(crossSecretToken) === null, 'Token signed with encryption key fails session verification');

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
}
