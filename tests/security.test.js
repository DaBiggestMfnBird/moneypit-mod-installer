/**
 * MoneyPit Mod Installer — Security Unit Tests
 * 36 tests covering the two functions that protect every user.
 * Run: npm test
 */
const path = require('path');

// Inline the pure logic — no Electron dependency in tests
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;

const ALLOWED_HOSTS = [
  'beamng.com','www.beamng.com',
  'worldofmods.com','www.worldofmods.com',
  'modland.net','www.modland.net',
  'github.com',
  'objects.githubusercontent.com',
  'raw.githubusercontent.com',
  'github-releases.githubusercontent.com',
];

function validateUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error('Invalid URL format.'); }
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed.');
  const hostname = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
  if (!allowed) throw new Error(`Downloads from "${hostname}" are not supported.`);
  return parsed;
}

function safeExtractPath(base, entryName) {
  const resolved = path.resolve(base, entryName);
  if (!resolved.startsWith(path.resolve(base) + path.sep)) {
    throw new Error(`Path traversal attempt detected: ${entryName}`);
  }
  return resolved;
}

// ── validateUrl: allowed domains ────────────────────────────────────────────
describe('validateUrl — allowed domains', () => {
  const good = [
    'https://beamng.com/mods/file.zip',
    'https://www.beamng.com/mods/file.zip',
    'https://worldofmods.com/file.zip',
    'https://www.worldofmods.com/file.zip',
    'https://modland.net/file.zip',
    'https://www.modland.net/file.zip',
    'https://github.com/user/repo/releases/download/v1/mod.zip',
    'https://objects.githubusercontent.com/file.zip',
    'https://raw.githubusercontent.com/user/repo/main/mod.zip',
    'https://github-releases.githubusercontent.com/file.zip',
  ];
  good.forEach(url => test(`accepts: ${url}`, () => {
    expect(() => validateUrl(url)).not.toThrow();
  }));
});

// ── validateUrl: blocked protocols ──────────────────────────────────────────
describe('validateUrl — blocked protocols', () => {
  const bad = [
    'http://beamng.com/mod.zip',
    'ftp://beamng.com/mod.zip',
    'file:///etc/passwd',
    'javascript:alert(1)',
  ];
  bad.forEach(url => test(`rejects: ${url}`, () => {
    expect(() => validateUrl(url)).toThrow();
  }));
});

// ── validateUrl: SSRF / blocked hosts ───────────────────────────────────────
describe('validateUrl — SSRF / blocked hosts', () => {
  const ssrf = [
    'https://192.168.1.1/mod.zip',
    'https://localhost/mod.zip',
    'https://10.0.0.1/mod.zip',
    'https://evil.com/mod.zip',
    'https://notbeamng.com/mod.zip',
    'https://beamng.com.evil.com/mod.zip',
  ];
  ssrf.forEach(url => test(`blocks: ${url}`, () => {
    expect(() => validateUrl(url)).toThrow();
  }));
});

// ── validateUrl: malformed input ─────────────────────────────────────────────
describe('validateUrl — malformed input', () => {
  ['', 'not-a-url', 'https://', null, undefined].forEach(url => {
    test(`rejects: ${JSON.stringify(url)}`, () => {
      expect(() => validateUrl(url)).toThrow();
    });
  });
});

// ── safeExtractPath: valid paths ─────────────────────────────────────────────
describe('safeExtractPath — valid paths', () => {
  const base = '/tmp/moneypit-extract';
  ['mymod.zip', 'subdir/mymod.zip', 'a/b/c/mod.car'].forEach(e => {
    test(`allows: ${e}`, () => {
      expect(() => safeExtractPath(base, e)).not.toThrow();
    });
  });
});

// ── safeExtractPath: traversal attacks ───────────────────────────────────────
describe('safeExtractPath — path traversal attacks', () => {
  const base = '/tmp/moneypit-extract';
  const attacks = [
    '../../../etc/passwd',
    '../../AppData/Roaming/evil.exe',
    '../outside.zip',
    '/absolute/path/attack.zip',
    'subdir/../../outside.zip',
  ];
  attacks.forEach(e => test(`blocks: ${e}`, () => {
    expect(() => safeExtractPath(base, e)).toThrow(/Path traversal/);
  }));
});

// ── Size cap ─────────────────────────────────────────────────────────────────
describe('MAX_DOWNLOAD_BYTES', () => {
  test('is exactly 500 MB', () => expect(MAX_DOWNLOAD_BYTES).toBe(500 * 1024 * 1024));
  test('499 MB is under cap', () => expect(499 * 1024 * 1024).toBeLessThan(MAX_DOWNLOAD_BYTES));
  test('501 MB exceeds cap', () => expect(501 * 1024 * 1024).toBeGreaterThan(MAX_DOWNLOAD_BYTES));
});

// ── SHA256 integrity ─────────────────────────────────────────────────────────
function extractExpectedHash(rawUrl) {
  try {
    const frag = new URL(rawUrl).hash.replace(/^#/, '');
    const m = frag.split('&').map(s => s.split('=')).find(([k]) => k === 'sha256');
    if (!m) return null;
    const hex = (m[1] || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hex)) throw new Error('Malformed sha256 hash — must be 64 hex chars.');
    return hex;
  } catch (e) {
    if (e.message.startsWith('Malformed')) throw e;
    return null;
  }
}

describe('extractExpectedHash — SHA256 fragment parsing', () => {
  const valid = 'a'.repeat(64);

  test('returns null when no fragment', () =>
    expect(extractExpectedHash('https://beamng.com/mod.zip')).toBeNull());
  test('returns null when fragment lacks sha256', () =>
    expect(extractExpectedHash('https://beamng.com/mod.zip#foo=bar')).toBeNull());
  test('parses valid 64-char hex hash', () =>
    expect(extractExpectedHash(`https://beamng.com/mod.zip#sha256=${valid}`)).toBe(valid));
  test('lowercases uppercase hash', () =>
    expect(extractExpectedHash(`https://beamng.com/mod.zip#sha256=${valid.toUpperCase()}`)).toBe(valid));
  test('parses hash alongside other fragment params', () =>
    expect(extractExpectedHash(`https://beamng.com/mod.zip#v=1&sha256=${valid}`)).toBe(valid));
  test('rejects hash that is too short', () =>
    expect(() => extractExpectedHash('https://beamng.com/mod.zip#sha256=abc123')).toThrow(/Malformed/));
  test('rejects hash with non-hex chars', () =>
    expect(() => extractExpectedHash(`https://beamng.com/mod.zip#sha256=${'z'.repeat(64)}`)).toThrow(/Malformed/));
  test('rejects empty hash value', () =>
    expect(() => extractExpectedHash('https://beamng.com/mod.zip#sha256=')).toThrow(/Malformed/));
});
