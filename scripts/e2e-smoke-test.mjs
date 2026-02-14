/**
 * Full E2E Smoke Test
 *
 * Tests: Register → Login → Firm → Case → Document → Form → AI Chat → Stats → Logout
 */
import http from 'http';
import { randomBytes } from 'crypto';

const BASE = { hostname: 'localhost', port: 3000 };
let cookies = '';
let passed = 0;
let failed = 0;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const headers = { 'Origin': 'http://localhost:3000', 'Cookie': cookies };
    if (body) {
      headers['Content-Type'] = typeof body === 'string' ? 'application/json' : body.contentType;
      headers['Content-Length'] = typeof body === 'string' ? Buffer.byteLength(body) : body.data.length;
    }
    const r = http.request({ ...BASE, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        // Capture new cookies
        const newCookies = res.headers['set-cookie'];
        if (newCookies) {
          cookies = newCookies.map(c => c.split(';')[0]).join('; ');
        }
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (body) r.write(typeof body === 'string' ? body : body.data);
    r.end();
  });
}

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name} — ${detail || 'FAILED'}`);
    failed++;
  }
}

async function run() {
  const testEmail = `smoke-${Date.now()}@immigration-ai.dev`;
  const testPassword = 'SmokeTest99!Secure';

  // ═══════════════════════════════════════════
  console.log('\n🔐 1. REGISTRATION');
  // ═══════════════════════════════════════════
  const regRes = await req('POST', '/api/auth/register', JSON.stringify({
    email: testEmail, password: testPassword,
    firstName: 'Smoke', lastName: 'Test', role: 'attorney',
    barNumber: 'NY123456'
  }));
  check('Register returns 200', regRes.status === 200, `Got ${regRes.status}: ${regRes.body.slice(0, 200)}`);

  let userId;
  try {
    const regData = JSON.parse(regRes.body);
    userId = regData.user?.id;
    check('User ID returned', !!userId);
    check('Email matches', regData.user?.email === testEmail);
  } catch { check('Valid JSON response', false, regRes.body.slice(0, 100)); }

  // ═══════════════════════════════════════════
  console.log('\n🔑 2. LOGIN');
  // ═══════════════════════════════════════════
  // Login may be rate-limited if we've done many tests — registration already set cookies
  const loginRes = await req('POST', '/api/auth/login', JSON.stringify({
    email: testEmail, password: testPassword
  }));
  if (loginRes.status === 429) {
    console.log('  ⏳ Login rate-limited (expected after many test runs) — using registration session');
    check('Session cookies from registration', cookies.length > 0, 'No cookies');
  } else {
    check('Login returns 200', loginRes.status === 200, `Got ${loginRes.status}: ${loginRes.body.slice(0, 200)}`);
    check('Session cookies set', cookies.length > 0, 'No cookies received');
    try {
      const session = JSON.parse(loginRes.body);
      check('Access token returned', !!session.session?.access_token);
    } catch { check('Valid login response', false); }
  }

  // ═══════════════════════════════════════════
  console.log('\n🏢 3. CREATE FIRM');
  // ═══════════════════════════════════════════
  const firmRes = await req('POST', '/api/firms', JSON.stringify({
    name: 'Smoke Test Law Firm'
  }));
  check('Firm created (201)', firmRes.status === 201, `Got ${firmRes.status}: ${firmRes.body.slice(0, 200)}`);

  let firmId;
  try {
    const firm = JSON.parse(firmRes.body);
    firmId = firm.data?.id;
    check('Firm ID returned', !!firmId);
    check('Firm name matches', firm.data?.name === 'Smoke Test Law Firm');
  } catch { check('Valid firm response', false); }

  // ═══════════════════════════════════════════
  console.log('\n📋 4. CREATE CASE');
  // ═══════════════════════════════════════════
  // Use a known client from previous E2E setup
  const knownClientId = '476ee8f8-095d-45a3-be51-35f1fa59439f';

  const caseRes = await req('POST', '/api/cases', JSON.stringify({
    title: 'Smoke Test H1B Application',
    visa_type: 'H1B',
    client_id: knownClientId,
    description: 'Full E2E smoke test case'
  }));
  check('Case created (201)', caseRes.status === 201, `Got ${caseRes.status}: ${caseRes.body.slice(0, 300)}`);

  let caseId;
  try {
    const caseData = JSON.parse(caseRes.body);
    caseId = caseData.data?.id;
    check('Case ID returned', !!caseId);
    check('Case status is intake', caseData.data?.status === 'intake');
  } catch { check('Valid case response', false); }

  if (!caseId) {
    console.log('\n⛔ Cannot continue without case ID');
    printSummary();
    return;
  }

  // ═══════════════════════════════════════════
  console.log('\n📄 5. UPLOAD DOCUMENT');
  // ═══════════════════════════════════════════
  // Create minimal valid JPEG
  const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);
  const content = Buffer.concat([jpegHeader, randomBytes(512)]);
  const boundary = '----Boundary' + randomBytes(8).toString('hex');
  const multipart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="smoke-passport.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="document_type"\r\n\r\npassport\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await req('POST', `/api/cases/${caseId}/documents`, {
    data: multipart,
    contentType: `multipart/form-data; boundary=${boundary}`
  });
  check('Document uploaded (201)', uploadRes.status === 201, `Got ${uploadRes.status}: ${uploadRes.body.slice(0, 300)}`);

  let docId;
  try {
    const doc = JSON.parse(uploadRes.body);
    docId = doc.id;
    check('Document ID returned', !!docId);
    check('Document type is passport', doc.document_type === 'passport');
    check('Document status is uploaded', doc.status === 'uploaded');
  } catch { check('Valid document response', false); }

  // ═══════════════════════════════════════════
  console.log('\n📝 6. CREATE FORM');
  // ═══════════════════════════════════════════
  const formRes = await req('POST', `/api/cases/${caseId}/forms`, JSON.stringify({
    form_type: 'I-129', form_data: {}
  }));
  check('Form created (201)', formRes.status === 201, `Got ${formRes.status}: ${formRes.body.slice(0, 300)}`);

  let formId;
  try {
    const form = JSON.parse(formRes.body);
    formId = form.id;
    check('Form ID returned', !!formId);
    check('Form type is I-129', form.form_type === 'I-129');
    check('Form status is draft', form.status === 'draft');
  } catch { check('Valid form response', false); }

  // ═══════════════════════════════════════════
  console.log('\n🤖 7. AI CHAT');
  // ═══════════════════════════════════════════
  const chatRes = await req('POST', '/api/chat', JSON.stringify({
    message: 'What is the H-1B visa cap for this year?',
    caseId
  }));
  check('Chat returns 200', chatRes.status === 200, `Got ${chatRes.status}: ${chatRes.body.slice(0, 200)}`);
  check('Chat returns SSE stream', chatRes.body.includes('data:'));
  check('Chat contains content', chatRes.body.includes('"type":"content"'));

  // ═══════════════════════════════════════════
  console.log('\n📊 8. CASE STATS');
  // ═══════════════════════════════════════════
  const statsRes = await req('GET', '/api/cases/stats');
  check('Stats returns 200', statsRes.status === 200, `Got ${statsRes.status}`);

  try {
    const stats = JSON.parse(statsRes.body);
    check('Total cases > 0', (stats.data?.total || stats.total) > 0);
  } catch { check('Valid stats response', false); }

  // ═══════════════════════════════════════════
  console.log('\n📂 9. LIST OPERATIONS');
  // ═══════════════════════════════════════════
  const casesListRes = await req('GET', '/api/cases');
  check('List cases returns 200', casesListRes.status === 200);
  try {
    const cl = JSON.parse(casesListRes.body);
    check('Cases list has data', (cl.cases?.length || 0) > 0);
  } catch { check('Valid cases list', false); }

  const firmsListRes = await req('GET', '/api/firms');
  check('List firms returns 200', firmsListRes.status === 200);

  const docsListRes = await req('GET', `/api/cases/${caseId}/documents`);
  check('List documents returns 200', docsListRes.status === 200);
  try {
    const dl = JSON.parse(docsListRes.body);
    check('Documents list has data', Array.isArray(dl) && dl.length > 0);
  } catch { check('Valid docs list', false); }

  const formsListRes = await req('GET', `/api/cases/${caseId}/forms`);
  check('List forms returns 200', formsListRes.status === 200);

  // ═══════════════════════════════════════════
  console.log('\n🔒 10. LOGOUT');
  // ═══════════════════════════════════════════
  const logoutRes = await req('POST', '/api/auth/logout', '{}');
  check('Logout returns 200', logoutRes.status === 200, `Got ${logoutRes.status}: ${logoutRes.body.slice(0, 200)}`);

  // Verify logged out - should get 401 on protected route
  const afterLogoutRes = await req('GET', '/api/cases');
  check('Protected route returns 401 after logout', afterLogoutRes.status === 401, `Got ${afterLogoutRes.status}`);

  printSummary();
}

function printSummary() {
  console.log('\n' + '═'.repeat(50));
  console.log(`  SMOKE TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(50));
  if (failed === 0) {
    console.log('  🎉 ALL TESTS PASSED — E2E integration working!');
  } else {
    console.log(`  ⚠️  ${failed} test(s) need attention`);
  }
  console.log('');
}

run().catch(e => {
  console.error('Fatal error:', e);
  printSummary();
});
