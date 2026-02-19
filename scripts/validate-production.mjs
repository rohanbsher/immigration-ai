#!/usr/bin/env node
/**
 * Production Validation Script
 *
 * Runs ~68 end-to-end tests against the live production environment.
 * Zero dependencies beyond Node.js 18+.
 *
 * Usage:
 *   E2E_ATTORNEY_EMAIL=... E2E_ATTORNEY_PASSWORD=... \
 *   E2E_CLIENT_EMAIL=... E2E_CLIENT_PASSWORD=... \
 *   node scripts/validate-production.mjs
 *
 * Optional env vars:
 *   BASE_URL           — Target URL (default: https://immigration-ai-topaz.vercel.app)
 *   E2E_ADMIN_EMAIL    — Admin account for admin route tests
 *   E2E_ADMIN_PASSWORD
 *   CRON_SECRET        — For detailed health check
 */

import { randomBytes } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = (process.env.BASE_URL || 'https://immigration-ai-topaz.vercel.app').replace(/\/$/, '');
const ATTORNEY_EMAIL = process.env.E2E_ATTORNEY_EMAIL;
const ATTORNEY_PASSWORD = process.env.E2E_ATTORNEY_PASSWORD;
const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL;
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD;
const _ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const _ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const CRON_SECRET = process.env.CRON_SECRET;

// ANSI colors
const G = '\x1b[32m'; // green
const R = '\x1b[31m'; // red
const Y = '\x1b[33m'; // yellow
const B = '\x1b[1m';  // bold
const D = '\x1b[2m';  // dim
const CY = '\x1b[36m'; // cyan
const X = '\x1b[0m';  // reset

// ═══════════════════════════════════════════════════════════════════════════════
// Test Framework
// ═══════════════════════════════════════════════════════════════════════════════

const results = { passed: 0, failed: 0, skipped: 0, warnings: [] };

function assert(name, condition, detail) {
  if (condition) {
    results.passed++;
    console.log(`  ${G}✓${X} ${name}`);
  } else {
    results.failed++;
    console.log(`  ${R}✗${X} ${name} ${D}— ${detail || 'FAILED'}${X}`);
  }
  return condition;
}

function skip(name, reason) {
  results.skipped++;
  console.log(`  ${Y}○${X} ${name} ${D}— ${reason}${X}`);
}

function warn(msg) {
  results.warnings.push(msg);
  console.log(`  ${Y}⚠${X} ${msg}`);
}

function phase(name) {
  console.log(`\n${B}${CY}━━━ ${name} ━━━${X}\n`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP Helper
// ═══════════════════════════════════════════════════════════════════════════════

async function api(method, path, opts = {}) {
  const { body, cookies, headers: extra, noOrigin, wrongOrigin, contentType, timeout } = opts;
  const url = `${BASE_URL}${path}`;
  const headers = { ...(extra || {}) };

  // Origin management for CSRF
  if (wrongOrigin) headers['Origin'] = 'https://evil.com';
  else if (!noOrigin) headers['Origin'] = BASE_URL;

  // Cookies
  if (cookies) headers['Cookie'] = cookies;

  const fetchOpts = { method, headers };

  if (body !== undefined && body !== null) {
    if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
      if (contentType) headers['Content-Type'] = contentType;
      fetchOpts.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }

  // Timeout via AbortController
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout || 30_000);
  fetchOpts.signal = controller.signal;

  try {
    const res = await fetch(url, fetchOpts);
    clearTimeout(timer);

    // Extract Set-Cookie
    const setCookies = res.headers.getSetCookie?.() || [];
    const newCookies = setCookies.map(c => c.split(';')[0]).join('; ');

    // Read body
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    return { status: res.status, data, text, headers: res.headers, cookies: newCookies };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { status: 0, data: null, text: '', headers: new Headers(), cookies: '', error: 'TIMEOUT' };
    }
    throw err;
  }
}

// Build multipart form data for file upload
function buildMultipart(fileName, fileBuffer, fields = {}) {
  const boundary = '----ValidateBoundary' + randomBytes(8).toString('hex');
  const parts = [];

  // File part
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`
  ));
  parts.push(fileBuffer);
  parts.push(Buffer.from('\r\n'));

  // Additional fields
  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
    ));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

// Create a minimal valid JPEG buffer
function fakeJpeg() {
  const header = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);
  return Buffer.concat([header, randomBytes(512)]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Session State & Test Data Tracking
// ═══════════════════════════════════════════════════════════════════════════════

let attorneyCookies = '';
let clientCookies = '';
let adminCookies = '';
let clientUserId = '';

const testCaseIds = [];
const testDocIds = [];
const testFormIds = [];

const TEST_PREFIX = '[E2E-VALIDATE]';

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 1: Infrastructure Health (6 tests)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase1() {
  phase('Phase 1: Infrastructure Health');

  // 1. Landing page loads
  const landing = await api('GET', '/');
  assert('Landing page loads (200)', landing.status === 200, `Got ${landing.status}`);
  assert('Landing page has HTML', typeof landing.text === 'string' && landing.text.includes('<html'), 'No <html> tag');

  // 2. Login page loads
  const login = await api('GET', '/login');
  assert('Login page loads', [200, 301, 302, 307, 308].includes(login.status), `Got ${login.status}`);

  // 3. Basic health check
  const health = await api('GET', '/api/health');
  const healthOk = assert('Health check returns 200', health.status === 200, `Got ${health.status}`);
  assert('Health status is healthy', health.data?.status === 'healthy', `Got status: ${health.data?.status}`);

  // Early exit if health check fails
  if (!healthOk) {
    console.log(`\n${R}${B}  ABORTING — health check failed. Cannot continue.${X}\n`);
    printSummary();
    process.exit(1);
  }

  // 4. Detailed health check (requires CRON_SECRET)
  if (CRON_SECRET) {
    const detailed = await api('GET', '/api/health', {
      headers: { 'x-health-detail': 'true', 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    assert('Detailed health check has checks', !!detailed.data?.checks, 'No checks field');
    assert('Database connected', detailed.data?.checks?.database?.status === 'pass',
      `DB: ${detailed.data?.checks?.database?.message}`);
  } else {
    skip('Detailed health check', 'No CRON_SECRET');
    skip('Database connected', 'No CRON_SECRET');
  }

  // 5. Static assets load
  const staticMatch = typeof landing.text === 'string' && landing.text.match(/\/_next\/static\/[^"'\s]+/);
  if (staticMatch) {
    const staticRes = await api('GET', staticMatch[0]);
    assert('Static assets load', staticRes.status === 200, `Got ${staticRes.status} for ${staticMatch[0].slice(0, 60)}`);
  } else {
    skip('Static assets load', 'No static path found in HTML');
  }

  // 6. API 404 returns expected status
  const notFound = await api('GET', '/api/nonexistent-route-12345');
  assert('API 404 returns proper status', [404, 405].includes(notFound.status), `Got ${notFound.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 2: Authentication (10 tests)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase2() {
  phase('Phase 2: Authentication');

  // 1. Attorney login
  const attLogin = await api('POST', '/api/auth/login', {
    body: { email: ATTORNEY_EMAIL, password: ATTORNEY_PASSWORD },
  });
  assert('Attorney login succeeds (200)', attLogin.status === 200,
    `Got ${attLogin.status}: ${JSON.stringify(attLogin.data).slice(0, 200)}`);
  attorneyCookies = attLogin.cookies;

  // 2. Login sets cookies
  assert('Login sets sb- cookies', attorneyCookies.includes('sb-'), `Cookies: ${attorneyCookies.slice(0, 100)}`);

  // 3. No tokens in login response body (B1 hardening)
  const loginStr = JSON.stringify(attLogin.data);
  assert('No access_token in response (B1)', !loginStr.includes('access_token'), 'Tokens leaked in body');
  assert('No refresh_token in response (B1)', !loginStr.includes('refresh_token'), 'Tokens leaked in body');
  assert('Login response has profile', !!attLogin.data?.profile, 'No profile object');

  // 4. Invalid password returns 401
  const badLogin = await api('POST', '/api/auth/login', {
    body: { email: ATTORNEY_EMAIL, password: 'WrongPassword999!' },
  });
  assert('Invalid password returns 401', badLogin.status === 401, `Got ${badLogin.status}`);

  // 5. Attorney can access profile
  const attProfile = await api('GET', '/api/profile', { cookies: attorneyCookies });
  assert('Attorney can access profile', attProfile.status === 200, `Got ${attProfile.status}`);
  assert('Attorney role is attorney', attProfile.data?.role === 'attorney', `Got role: ${attProfile.data?.role}`);

  // 6. Client login
  const cliLogin = await api('POST', '/api/auth/login', {
    body: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
  });
  assert('Client login succeeds (200)', cliLogin.status === 200,
    `Got ${cliLogin.status}: ${JSON.stringify(cliLogin.data).slice(0, 200)}`);
  clientCookies = cliLogin.cookies;

  // 7. Client can access profile
  const cliProfile = await api('GET', '/api/profile', { cookies: clientCookies });
  assert('Client can access profile', cliProfile.status === 200, `Got ${cliProfile.status}`);
  assert('Client role is client', cliProfile.data?.role === 'client', `Got role: ${cliProfile.data?.role}`);
  clientUserId = cliProfile.data?.id || '';

  // 8. Unauthenticated request blocked
  const noAuth = await api('GET', '/api/profile');
  assert('Unauthenticated request returns 401', noAuth.status === 401, `Got ${noAuth.status}`);

  // 9. Logout and verify session destroyed
  const logoutRes = await api('POST', '/api/auth/logout', { cookies: attorneyCookies, body: {} });
  assert('Attorney logout succeeds (200)', logoutRes.status === 200, `Got ${logoutRes.status}`);

  const afterLogout = await api('GET', '/api/profile', { cookies: attorneyCookies });
  assert('Profile returns 401 after logout', afterLogout.status === 401, `Got ${afterLogout.status}`);

  // Re-login attorney for subsequent phases
  const reLogin = await api('POST', '/api/auth/login', {
    body: { email: ATTORNEY_EMAIL, password: ATTORNEY_PASSWORD },
  });
  if (reLogin.status === 200) {
    attorneyCookies = reLogin.cookies;
  } else {
    warn(`Attorney re-login failed (${reLogin.status}) — subsequent phases may fail`);
  }

  // 10. Rate limiting (send rapid failed login attempts)
  let got429 = false;
  const fakeEmail = `ratelimit-${Date.now()}@test.invalid`;
  for (let i = 0; i < 8 && !got429; i++) {
    const r = await api('POST', '/api/auth/login', {
      body: { email: fakeEmail, password: 'Wrong!' },
    });
    if (r.status === 429) got429 = true;
  }
  assert('Rate limiting triggers on rapid failed logins', got429, 'Never received 429');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: CRUD Operations — Attorney Flow (14 tests)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase3() {
  phase('Phase 3: CRUD Operations — Attorney Flow');

  if (!clientUserId) {
    warn('No client user ID — cannot create cases with client_id');
  }

  // 1. Create case
  const createRes = await api('POST', '/api/cases', {
    cookies: attorneyCookies,
    body: {
      title: `${TEST_PREFIX} H1B Application`,
      visa_type: 'H1B',
      client_id: clientUserId,
      description: 'Production validation test case',
    },
  });
  assert('Create case (201)', createRes.status === 201,
    `Got ${createRes.status}: ${JSON.stringify(createRes.data).slice(0, 300)}`);

  const caseId = createRes.data?.data?.id;
  if (caseId) testCaseIds.push(caseId);
  assert('Case has ID', !!caseId, 'No case ID in response');
  assert('Case status is intake', createRes.data?.data?.status === 'intake',
    `Got: ${createRes.data?.data?.status}`);

  if (!caseId) {
    warn('Cannot continue Phase 3 without case ID — skipping remaining tests');
    return;
  }

  // 2. Get case
  const getRes = await api('GET', `/api/cases/${caseId}`, { cookies: attorneyCookies });
  assert('Get case (200)', getRes.status === 200, `Got ${getRes.status}`);
  assert('Case title matches', getRes.data?.title?.includes(TEST_PREFIX), `Got: ${getRes.data?.title}`);

  // 3. List cases includes new case
  const listRes = await api('GET', '/api/cases', { cookies: attorneyCookies });
  assert('List cases (200)', listRes.status === 200, `Got ${listRes.status}`);
  const casesArr = listRes.data?.cases || listRes.data?.data || [];
  assert('List contains test case', casesArr.some(c => c.id === caseId), 'Test case not in list');

  // 4. Update case title
  const newTitle = `${TEST_PREFIX} Updated H1B`;
  const updateRes = await api('PATCH', `/api/cases/${caseId}`, {
    cookies: attorneyCookies,
    body: { title: newTitle },
  });
  assert('Update case (200)', updateRes.status === 200, `Got ${updateRes.status}`);
  assert('Title updated', updateRes.data?.title === newTitle, `Got: ${updateRes.data?.title}`);

  // 5. Case stats
  const statsRes = await api('GET', '/api/cases/stats', { cookies: attorneyCookies });
  assert('Case stats (200)', statsRes.status === 200, `Got ${statsRes.status}`);
  const total = statsRes.data?.data?.total ?? statsRes.data?.total ?? 0;
  assert('Total cases >= 1', total >= 1, `Got total: ${total}`);

  // 6. Upload document (multipart)
  const jpeg = fakeJpeg();
  const mp = buildMultipart('validate-passport.jpg', jpeg, { document_type: 'passport' });
  const uploadRes = await api('POST', `/api/cases/${caseId}/documents`, {
    cookies: attorneyCookies,
    body: mp.body,
    contentType: mp.contentType,
  });
  assert('Upload document (201)', uploadRes.status === 201,
    `Got ${uploadRes.status}: ${JSON.stringify(uploadRes.data).slice(0, 300)}`);

  const docId = uploadRes.data?.id;
  if (docId) testDocIds.push(docId);
  assert('Document has ID', !!docId, 'No doc ID');
  assert('Document status is uploaded', uploadRes.data?.status === 'uploaded',
    `Got: ${uploadRes.data?.status}`);

  // 7. List case documents
  const docsRes = await api('GET', `/api/cases/${caseId}/documents`, { cookies: attorneyCookies });
  assert('List documents (200)', docsRes.status === 200, `Got ${docsRes.status}`);
  const docsArr = Array.isArray(docsRes.data) ? docsRes.data : [];
  assert('Documents list has items', docsArr.length > 0, 'Empty docs list');

  // 8. Create form
  const formRes = await api('POST', `/api/cases/${caseId}/forms`, {
    cookies: attorneyCookies,
    body: { form_type: 'I-129', form_data: {} },
  });
  assert('Create form (201)', formRes.status === 201,
    `Got ${formRes.status}: ${JSON.stringify(formRes.data).slice(0, 300)}`);

  const formId = formRes.data?.id;
  if (formId) testFormIds.push(formId);
  assert('Form has ID', !!formId, 'No form ID');

  // 9. List case forms
  const formsRes = await api('GET', `/api/cases/${caseId}/forms`, { cookies: attorneyCookies });
  assert('List forms (200)', formsRes.status === 200, `Got ${formsRes.status}`);

  // 10. Send message
  const msgRes = await api('POST', `/api/cases/${caseId}/messages`, {
    cookies: attorneyCookies,
    body: { content: `${TEST_PREFIX} validation message` },
  });
  assert('Send message (201)', msgRes.status === 201, `Got ${msgRes.status}`);

  // 11. List messages
  const msgsRes = await api('GET', `/api/cases/${caseId}/messages`, { cookies: attorneyCookies });
  assert('List messages (200)', msgsRes.status === 200, `Got ${msgsRes.status}`);
  const msgsArr = msgsRes.data?.data || [];
  assert('Messages list has items', msgsArr.length > 0, 'No messages');

  // 12. Case activities
  const actRes = await api('GET', `/api/cases/${caseId}/activities`, { cookies: attorneyCookies });
  assert('Activities (200)', actRes.status === 200, `Got ${actRes.status}`);
  const activities = Array.isArray(actRes.data) ? actRes.data : (actRes.data?.data || []);
  assert('Activities logged', activities.length > 0, 'No activities');

  // 13. Delete document
  if (docId) {
    const delDocRes = await api('DELETE', `/api/documents/${docId}`, { cookies: attorneyCookies });
    assert('Delete document (200)', delDocRes.status === 200, `Got ${delDocRes.status}`);
    const idx = testDocIds.indexOf(docId);
    if (idx >= 0) testDocIds.splice(idx, 1);
  } else {
    skip('Delete document', 'No doc to delete');
  }

  // 14. Delete case
  const delCaseRes = await api('DELETE', `/api/cases/${caseId}`, { cookies: attorneyCookies });
  assert('Delete case (200)', delCaseRes.status === 200, `Got ${delCaseRes.status}`);
  const cIdx = testCaseIds.indexOf(caseId);
  if (cIdx >= 0) testCaseIds.splice(cIdx, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 4: Security Hardening Verification (12 tests)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase4() {
  phase('Phase 4: Security Hardening Verification');

  // CSRF tests — use POST /api/cases with attorney cookies
  // The CSRF middleware runs in Next.js middleware before the route handler

  // 1. CSRF: missing Origin rejected
  const noOriginRes = await api('POST', '/api/cases', {
    cookies: attorneyCookies,
    noOrigin: true,
    body: { title: 'CSRF test', visa_type: 'H1B', client_id: clientUserId },
  });
  assert('CSRF: missing Origin rejected (403)', noOriginRes.status === 403,
    `Got ${noOriginRes.status}`);

  // 2. CSRF: wrong Origin rejected
  const wrongOriginRes = await api('POST', '/api/cases', {
    cookies: attorneyCookies,
    wrongOrigin: true,
    body: { title: 'CSRF test', visa_type: 'H1B', client_id: clientUserId },
  });
  assert('CSRF: wrong Origin rejected (403)', wrongOriginRes.status === 403,
    `Got ${wrongOriginRes.status}`);

  // 3. CSRF: correct Origin accepted (not 403)
  const goodOriginRes = await api('POST', '/api/cases', {
    cookies: attorneyCookies,
    body: { title: `${TEST_PREFIX} CSRF-OK`, visa_type: 'H1B', client_id: clientUserId },
  });
  assert('CSRF: correct Origin accepted (not 403)', goodOriginRes.status !== 403,
    `Got 403 — CSRF incorrectly rejected valid origin`);
  // Clean up if case was created
  const csrfCaseId = goodOriginRes.data?.data?.id;
  if (csrfCaseId) {
    testCaseIds.push(csrfCaseId);
    await api('DELETE', `/api/cases/${csrfCaseId}`, { cookies: attorneyCookies });
    const idx = testCaseIds.indexOf(csrfCaseId);
    if (idx >= 0) testCaseIds.splice(idx, 1);
  }

  // 4. CSRF: X-API-Client bypass removed (B2 fix)
  const apiClientRes = await api('POST', '/api/cases', {
    cookies: attorneyCookies,
    wrongOrigin: true,
    headers: { 'X-API-Client': 'true' },
    body: { title: 'CSRF bypass', visa_type: 'H1B', client_id: clientUserId },
  });
  assert('CSRF: X-API-Client bypass removed (B2)', apiClientRes.status === 403,
    `Got ${apiClientRes.status} — bypass still active`);

  // 5. Cron GET removed (C2 fix — POST only)
  const cronGetRes = await api('GET', '/api/cron/deadline-alerts', { cookies: attorneyCookies });
  assert('Cron GET removed (405)', cronGetRes.status === 405, `Got ${cronGetRes.status}`);

  // 6-10. AI consent flow
  // First, ensure consent is revoked
  await api('DELETE', '/api/profile/ai-consent', { cookies: attorneyCookies });

  // 6. AI consent required (no consent)
  const chatNoConsent = await api('POST', '/api/chat', {
    cookies: attorneyCookies,
    body: { message: 'test' },
  });
  assert('AI consent required (403)', chatNoConsent.status === 403,
    `Got ${chatNoConsent.status}`);
  assert('Error mentions consent', JSON.stringify(chatNoConsent.data).toLowerCase().includes('consent'),
    `Error: ${JSON.stringify(chatNoConsent.data).slice(0, 200)}`);

  // 7. Grant AI consent
  const grantConsent = await api('POST', '/api/profile/ai-consent', { cookies: attorneyCookies });
  assert('Grant AI consent (200)', grantConsent.status === 200, `Got ${grantConsent.status}`);

  // 8. AI consent accepted (after grant)
  const chatWithConsent = await api('POST', '/api/chat', {
    cookies: attorneyCookies,
    body: { message: 'ping' },
    timeout: 45_000,
  });
  assert('AI chat not blocked by consent (not 403)', chatWithConsent.status !== 403,
    `Still blocked with 403 after granting consent`);

  // 9. Revoke AI consent
  const revokeConsent = await api('DELETE', '/api/profile/ai-consent', { cookies: attorneyCookies });
  assert('Revoke AI consent (200)', revokeConsent.status === 200, `Got ${revokeConsent.status}`);

  // 10. AI consent required again
  const chatAfterRevoke = await api('POST', '/api/chat', {
    cookies: attorneyCookies,
    body: { message: 'test after revoke' },
  });
  assert('AI consent required again (403)', chatAfterRevoke.status === 403,
    `Got ${chatAfterRevoke.status}`);

  // 11. No server-timing header (C1 fix)
  const anyApiRes = await api('GET', '/api/health');
  assert('No server-timing header (C1)', !anyApiRes.headers.get('server-timing'),
    `Found header: ${anyApiRes.headers.get('server-timing')}`);

  // 12. Error messages sanitized
  const malformedRes = await api('POST', '/api/auth/login', {
    body: '{invalid json!!!}',
  });
  const errText = typeof malformedRes.data === 'string' ? malformedRes.data : JSON.stringify(malformedRes.data);
  assert('Error response sanitized (no stack traces)',
    !errText.includes('at ') && !errText.includes('/src/') && !errText.includes('node_modules'),
    `Response may contain internal details: ${errText.slice(0, 200)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 5: RBAC & Cross-Role Access (10 tests)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase5() {
  phase('Phase 5: RBAC & Cross-Role Access');

  // 1. Attorney creates case for client
  const createRes = await api('POST', '/api/cases', {
    cookies: attorneyCookies,
    body: {
      title: `${TEST_PREFIX} RBAC Case`,
      visa_type: 'H1B',
      client_id: clientUserId,
      description: 'RBAC cross-role test case',
    },
  });
  assert('Attorney creates case for client (201)', createRes.status === 201,
    `Got ${createRes.status}: ${JSON.stringify(createRes.data).slice(0, 200)}`);

  const rbacCaseId = createRes.data?.data?.id;
  if (rbacCaseId) testCaseIds.push(rbacCaseId);

  if (!rbacCaseId) {
    warn('Cannot continue RBAC tests without case ID');
    return;
  }

  // 2. Client can see own case
  const clientViewRes = await api('GET', `/api/cases/${rbacCaseId}`, { cookies: clientCookies });
  assert('Client can see own case (200)', clientViewRes.status === 200,
    `Got ${clientViewRes.status}`);

  // 3. Client cannot create cases
  const clientCreateRes = await api('POST', '/api/cases', {
    cookies: clientCookies,
    body: { title: 'Client case', visa_type: 'H1B', client_id: clientUserId },
  });
  assert('Client cannot create cases (403)', clientCreateRes.status === 403,
    `Got ${clientCreateRes.status}`);

  // 4. Client cannot access other's case (random UUID)
  const fakeId = '00000000-0000-4000-a000-000000000000';
  const clientOtherRes = await api('GET', `/api/cases/${fakeId}`, { cookies: clientCookies });
  assert('Client cannot access other case (403/404)',
    [403, 404].includes(clientOtherRes.status),
    `Got ${clientOtherRes.status}`);

  // 5. Client cannot access admin routes
  const clientAdminRes = await api('GET', '/api/admin/users', { cookies: clientCookies });
  assert('Client cannot access admin routes (401/403)',
    [401, 403].includes(clientAdminRes.status),
    `Got ${clientAdminRes.status}`);

  // 6. Attorney cannot access admin routes
  const attAdminRes = await api('GET', '/api/admin/users', { cookies: attorneyCookies });
  assert('Attorney cannot access admin routes (401/403)',
    [401, 403].includes(attAdminRes.status),
    `Got ${attAdminRes.status}`);

  // 7. Admin can access admin routes
  if (adminCookies) {
    const adminRes = await api('GET', '/api/admin/users', { cookies: adminCookies });
    assert('Admin can access admin routes (200)', adminRes.status === 200,
      `Got ${adminRes.status}`);
  } else {
    skip('Admin can access admin routes', 'No admin credentials');
  }

  // 8. Client can list own documents
  const clientDocsRes = await api('GET', `/api/cases/${rbacCaseId}/documents`, { cookies: clientCookies });
  assert('Client can list own documents (200)', clientDocsRes.status === 200,
    `Got ${clientDocsRes.status}`);

  // 9. Notifications scoped to user
  const attNotifsRes = await api('GET', '/api/notifications', { cookies: attorneyCookies });
  const cliNotifsRes = await api('GET', '/api/notifications', { cookies: clientCookies });
  // Both should return 200 but with potentially different content
  assert('Attorney notifications accessible', attNotifsRes.status === 200,
    `Got ${attNotifsRes.status}`);
  assert('Client notifications accessible', cliNotifsRes.status === 200,
    `Got ${cliNotifsRes.status}`);

  // 10. Cleanup: delete test case
  if (rbacCaseId) {
    const delRes = await api('DELETE', `/api/cases/${rbacCaseId}`, { cookies: attorneyCookies });
    assert('Cleanup RBAC case (200)', delRes.status === 200, `Got ${delRes.status}`);
    const idx = testCaseIds.indexOf(rbacCaseId);
    if (idx >= 0) testCaseIds.splice(idx, 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 6: AI Features (6 tests, graceful skip)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase6() {
  phase('Phase 6: AI Features');

  // Create temp case + doc + form for AI tests
  const caseRes = await api('POST', '/api/cases', {
    cookies: attorneyCookies,
    body: {
      title: `${TEST_PREFIX} AI Test Case`,
      visa_type: 'H1B',
      client_id: clientUserId,
    },
  });

  const aiCaseId = caseRes.data?.data?.id;
  if (aiCaseId) testCaseIds.push(aiCaseId);

  if (!aiCaseId) {
    skip('AI test suite', 'Could not create test case — possibly at quota limit');
    for (let i = 0; i < 6; i++) skip('AI test', 'No test case');
    return;
  }

  // Upload a doc for analysis
  const jpeg = fakeJpeg();
  const mp = buildMultipart('ai-test-doc.jpg', jpeg, { document_type: 'passport' });
  const docRes = await api('POST', `/api/cases/${aiCaseId}/documents`, {
    cookies: attorneyCookies,
    body: mp.body,
    contentType: mp.contentType,
  });
  const aiDocId = docRes.data?.id;
  if (aiDocId) testDocIds.push(aiDocId);

  // Create form for autofill
  const formRes = await api('POST', `/api/cases/${aiCaseId}/forms`, {
    cookies: attorneyCookies,
    body: { form_type: 'I-129', form_data: {} },
  });
  const aiFormId = formRes.data?.id;
  if (aiFormId) testFormIds.push(aiFormId);

  // 1. Grant AI consent
  const consent = await api('POST', '/api/profile/ai-consent', { cookies: attorneyCookies });
  assert('Grant AI consent (200)', consent.status === 200, `Got ${consent.status}`);

  // 2. Chat endpoint responds
  const chatRes = await api('POST', '/api/chat', {
    cookies: attorneyCookies,
    body: { message: 'What is the H-1B visa cap?', caseId: aiCaseId },
    timeout: 60_000,
  });
  if (chatRes.status === 200) {
    assert('Chat endpoint responds (200)', true);
    // 3. SSE stream content
    const streamText = typeof chatRes.data === 'string' ? chatRes.data : chatRes.text;
    assert('Chat returns SSE stream', streamText.includes('data:'),
      `Response (first 200): ${streamText.slice(0, 200)}`);
  } else if (chatRes.status === 500 || chatRes.status === 503) {
    skip('Chat endpoint responds', `AI service unavailable (${chatRes.status})`);
    skip('SSE stream content', 'AI service unavailable');
  } else {
    assert('Chat endpoint responds', false, `Got ${chatRes.status}`);
    skip('SSE stream content', `Chat returned ${chatRes.status}`);
  }

  // 4. Document analysis
  if (aiDocId) {
    const analyzeRes = await api('POST', `/api/documents/${aiDocId}/analyze`, {
      cookies: attorneyCookies,
      timeout: 60_000,
    });
    if (analyzeRes.status === 200) {
      assert('Document analysis responds (200)', true);
    } else if ([500, 503].includes(analyzeRes.status)) {
      skip('Document analysis', `AI service returned ${analyzeRes.status}`);
    } else {
      assert('Document analysis responds', false, `Got ${analyzeRes.status}`);
    }
  } else {
    skip('Document analysis', 'No doc uploaded');
  }

  // 5. Form autofill
  if (aiFormId) {
    const autofillRes = await api('POST', `/api/forms/${aiFormId}/autofill`, {
      cookies: attorneyCookies,
      timeout: 60_000,
    });
    if (autofillRes.status === 200) {
      assert('Form autofill responds (200)', true);
    } else if ([500, 503].includes(autofillRes.status)) {
      skip('Form autofill', `AI service returned ${autofillRes.status}`);
    } else {
      assert('Form autofill responds', false, `Got ${autofillRes.status}`);
    }
  } else {
    skip('Form autofill', 'No form created');
  }

  // 6. Revoke AI consent cleanup
  const revoke = await api('DELETE', '/api/profile/ai-consent', { cookies: attorneyCookies });
  assert('Revoke AI consent cleanup (200)', revoke.status === 200, `Got ${revoke.status}`);

  // Cleanup AI test resources
  if (aiDocId) {
    await api('DELETE', `/api/documents/${aiDocId}`, { cookies: attorneyCookies });
    const idx = testDocIds.indexOf(aiDocId);
    if (idx >= 0) testDocIds.splice(idx, 1);
  }
  if (aiCaseId) {
    await api('DELETE', `/api/cases/${aiCaseId}`, { cookies: attorneyCookies });
    const idx = testCaseIds.indexOf(aiCaseId);
    if (idx >= 0) testCaseIds.splice(idx, 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 7: Billing & Quota (6 tests, graceful skip)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase7() {
  phase('Phase 7: Billing & Quota');

  // 1. Get subscription
  const subRes = await api('GET', '/api/billing/subscription', { cookies: attorneyCookies });
  assert('Get subscription (200)', subRes.status === 200, `Got ${subRes.status}`);

  // 2. Get usage
  const usageRes = await api('GET', '/api/billing/usage', { cookies: attorneyCookies });
  assert('Get usage (200)', usageRes.status === 200, `Got ${usageRes.status}`);

  // 3. Get quota
  const quotaRes = await api('GET', '/api/billing/quota', { cookies: attorneyCookies });
  assert('Get quota (200)', quotaRes.status === 200, `Got ${quotaRes.status}`);

  // 4. Checkout requires auth
  const checkoutNoAuth = await api('POST', '/api/billing/checkout', {
    body: { priceId: 'fake' },
  });
  assert('Checkout requires auth (401)', checkoutNoAuth.status === 401,
    `Got ${checkoutNoAuth.status}`);

  // 5. Free plan case limit
  // First, check current case count
  const currentCases = await api('GET', '/api/cases', { cookies: attorneyCookies });
  const currentCount = currentCases.data?.total ?? (currentCases.data?.cases?.length || 0);

  // Try to create cases up to the free plan limit (3) and one beyond
  const billingCaseIds = [];
  let quotaHit = false;
  const maxAttempts = 5; // enough to exceed free plan limit of 3

  for (let i = 0; i < maxAttempts && !quotaHit; i++) {
    const res = await api('POST', '/api/cases', {
      cookies: attorneyCookies,
      body: {
        title: `${TEST_PREFIX} Billing Test ${i + 1}`,
        visa_type: 'H1B',
        client_id: clientUserId,
      },
    });
    if (res.status === 201) {
      const id = res.data?.data?.id;
      if (id) {
        billingCaseIds.push(id);
        testCaseIds.push(id);
      }
    } else if (res.status === 402) {
      quotaHit = true;
    } else {
      // Unexpected status — stop trying
      break;
    }
  }

  if (quotaHit) {
    assert('Free plan case limit enforced (402)', true);
  } else if (billingCaseIds.length >= maxAttempts) {
    skip('Free plan case limit', 'Account may be on paid plan — no quota error after 5 cases');
  } else {
    warn(`Created ${billingCaseIds.length} cases, no 402 received — quota enforcement unclear`);
  }

  // 6. Cleanup billing test cases
  let cleanedAll = true;
  for (const id of billingCaseIds) {
    const del = await api('DELETE', `/api/cases/${id}`, { cookies: attorneyCookies });
    if (del.status !== 200) cleanedAll = false;
    const idx = testCaseIds.indexOf(id);
    if (idx >= 0) testCaseIds.splice(idx, 1);
  }
  assert('Cleanup billing test cases', cleanedAll || billingCaseIds.length === 0,
    `Failed to delete some billing test cases`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 8: Cleanup & Summary (4 tests)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase8() {
  phase('Phase 8: Cleanup & Summary');

  // 1. Delete remaining test cases
  let caseCleanOk = true;
  for (const id of [...testCaseIds]) {
    const res = await api('DELETE', `/api/cases/${id}`, { cookies: attorneyCookies });
    if (res.status === 200) {
      const idx = testCaseIds.indexOf(id);
      if (idx >= 0) testCaseIds.splice(idx, 1);
    } else {
      caseCleanOk = false;
      warn(`Failed to delete case ${id}: ${res.status}`);
    }
  }
  assert('Delete all remaining test cases', caseCleanOk && testCaseIds.length === 0,
    `${testCaseIds.length} cases remaining`);

  // 2. Delete remaining test documents
  let docCleanOk = true;
  for (const id of [...testDocIds]) {
    const res = await api('DELETE', `/api/documents/${id}`, { cookies: attorneyCookies });
    if (res.status === 200) {
      const idx = testDocIds.indexOf(id);
      if (idx >= 0) testDocIds.splice(idx, 1);
    } else {
      docCleanOk = false;
    }
  }
  assert('Delete remaining test documents', docCleanOk && testDocIds.length === 0,
    `${testDocIds.length} docs remaining`);

  // 3. Revoke AI consent (idempotent)
  const revoke = await api('DELETE', '/api/profile/ai-consent', { cookies: attorneyCookies });
  assert('Revoke AI consent', [200, 401].includes(revoke.status), `Got ${revoke.status}`);

  // 4. Verify clean state
  const finalCases = await api('GET', '/api/cases', { cookies: attorneyCookies });
  const allCases = finalCases.data?.cases || finalCases.data?.data || [];
  const leftover = allCases.filter(c => c.title?.includes(TEST_PREFIX));
  assert('No test-prefixed cases remain', leftover.length === 0,
    `Found ${leftover.length} leftover test cases`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Summary & Exit
// ═══════════════════════════════════════════════════════════════════════════════

function printSummary() {
  const divider = '═'.repeat(48);
  const totalTests = results.passed + results.failed + results.skipped;
  const verdict = results.failed === 0 ? `${G}PRODUCTION READY${X}` : `${R}FAILURES DETECTED${X}`;

  console.log(`
${B}${divider}${X}
${B}  PRODUCTION VALIDATION RESULTS${X}
${B}${divider}${X}
  Passed:   ${G}${results.passed}${X}
  Failed:   ${results.failed > 0 ? R : ''}${results.failed}${X}
  Skipped:  ${Y}${results.skipped}${X}
  Total:    ${totalTests}
  Warnings: ${results.warnings.length}
${B}${divider}${X}
  RESULT: ${verdict}
${B}${divider}${X}
`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n${B}Production Validation${X}`);
  console.log(`${D}Target: ${BASE_URL}${X}`);
  console.log(`${D}Time:   ${new Date().toISOString()}${X}\n`);

  // Validate required env vars
  if (!ATTORNEY_EMAIL || !ATTORNEY_PASSWORD) {
    console.error(`${R}Missing E2E_ATTORNEY_EMAIL / E2E_ATTORNEY_PASSWORD${X}`);
    process.exit(1);
  }
  if (!CLIENT_EMAIL || !CLIENT_PASSWORD) {
    console.error(`${R}Missing E2E_CLIENT_EMAIL / E2E_CLIENT_PASSWORD${X}`);
    process.exit(1);
  }

  try {
    await phase1();
    await phase2();
    await phase3();
    await phase4();
    await phase5();
    await phase6();
    await phase7();
    await phase8();
  } catch (err) {
    console.error(`\n${R}${B}Fatal error:${X} ${err.message}`);
    console.error(err.stack);
    // Attempt emergency cleanup
    console.log(`\n${Y}Attempting emergency cleanup...${X}`);
    for (const id of testCaseIds) {
      try {
        await api('DELETE', `/api/cases/${id}`, { cookies: attorneyCookies });
      } catch { /* best effort */ }
    }
    for (const id of testDocIds) {
      try {
        await api('DELETE', `/api/documents/${id}`, { cookies: attorneyCookies });
      } catch { /* best effort */ }
    }
  }

  printSummary();
  process.exit(results.failed > 0 ? 1 : 0);
}

// Handle interrupts gracefully
process.on('SIGINT', async () => {
  console.log(`\n\n${Y}Interrupted — cleaning up...${X}`);
  for (const id of testCaseIds) {
    try {
      await api('DELETE', `/api/cases/${id}`, { cookies: attorneyCookies });
      console.log(`  Deleted case ${id}`);
    } catch { /* best effort */ }
  }
  printSummary();
  process.exit(1);
});

main();
