import http from 'http';

function req(opts, data) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    r.on('error', reject);
    if (data) r.write(typeof data === 'string' ? data : data);
    r.end();
  });
}

async function run() {
  // Login
  const loginData = JSON.stringify({
    email: 'e2e-test-attorney@casefill.ai',
    password: 'TestPass123Secure'
  });
  const loginRes = await req({
    hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length, 'Origin': 'http://localhost:3000' }
  }, loginData);
  const cookies = loginRes.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
  console.log('Login:', loginRes.status);

  // Get case and document IDs
  const listRes = await req({
    hostname: 'localhost', port: 3000, path: '/api/cases?limit=1', method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Cookie': cookies }
  });
  const caseId = JSON.parse(listRes.body).cases?.[0]?.id;
  console.log('Case:', caseId);

  const docsRes = await req({
    hostname: 'localhost', port: 3000, path: `/api/cases/${caseId}/documents`, method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Cookie': cookies }
  });
  const docs = JSON.parse(docsRes.body);
  const docId = docs[0]?.id;
  console.log('Document:', docId, '- Status:', docs[0]?.status);

  if (!docId) { console.log('No documents found'); return; }

  // Test 1: Document Analysis (OpenAI GPT-4 Vision)
  console.log('\n--- Test 1: Document Analysis (OpenAI GPT-4 Vision) ---');
  const analyzeRes = await req({
    hostname: 'localhost', port: 3000, path: `/api/documents/${docId}/analyze`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000', 'Cookie': cookies }
  });
  console.log('Analyze status:', analyzeRes.status);
  try {
    const result = JSON.parse(analyzeRes.body);
    if (result.analysis) {
      console.log('Confidence:', result.analysis.overall_confidence);
      console.log('Fields extracted:', result.analysis.fields_extracted);
      console.log('Processing time:', result.analysis.processing_time_ms, 'ms');
      console.log('Warnings:', result.analysis.warnings);
    } else {
      console.log('Response:', JSON.stringify(result).slice(0, 500));
    }
  } catch(e) { console.log('Raw:', analyzeRes.body.slice(0, 500)); }

  // Test 2: Form Autofill (Claude)
  console.log('\n--- Test 2: Form Autofill (Claude) ---');
  // Get form ID
  const formsRes = await req({
    hostname: 'localhost', port: 3000, path: `/api/cases/${caseId}/forms`, method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Cookie': cookies }
  });
  const forms = JSON.parse(formsRes.body);
  const formId = (Array.isArray(forms) ? forms : forms.data)?.[0]?.id;
  console.log('Form:', formId);

  if (formId) {
    const autofillRes = await req({
      hostname: 'localhost', port: 3000, path: `/api/forms/${formId}/autofill`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000', 'Cookie': cookies }
    });
    console.log('Autofill status:', autofillRes.status);
    try {
      const result = JSON.parse(autofillRes.body);
      if (result.fields_filled) {
        console.log('Fields filled:', result.fields_filled);
      } else {
        console.log('Response:', JSON.stringify(result).slice(0, 500));
      }
    } catch(e) { console.log('Raw:', autofillRes.body.slice(0, 500)); }
  }

  // Test 3: AI Chat (Claude SSE streaming)
  console.log('\n--- Test 3: AI Chat ---');
  const chatData = JSON.stringify({
    message: 'What documents are typically needed for an H-1B visa application?',
    caseId: caseId
  });
  const chatRes = await req({
    hostname: 'localhost', port: 3000, path: '/api/chat', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': chatData.length, 'Origin': 'http://localhost:3000', 'Cookie': cookies }
  }, chatData);
  console.log('Chat status:', chatRes.status);
  console.log('Chat response (first 500 chars):', chatRes.body.slice(0, 500));

  console.log('\n--- AI Tests Complete ---');
}

run().catch(e => console.error('Fatal:', e));
