import http from 'http';
import { randomBytes } from 'crypto';

function req(opts, data) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    r.on('error', reject);
    if (data) r.write(data);
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
    hostname: 'localhost', port: 3000, path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length, 'Origin': 'http://localhost:3000' }
  }, loginData);

  const cookies = loginRes.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
  console.log('Login:', loginRes.status);

  // Get case ID
  const listRes = await req({
    hostname: 'localhost', port: 3000, path: '/api/cases?limit=1',
    method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Cookie': cookies }
  });

  const cases = JSON.parse(listRes.body);
  const caseId = cases.cases?.[0]?.id;
  console.log('Case ID:', caseId);
  if (!caseId) { console.log('No cases found'); return; }

  // Create minimal JPEG (FF D8 FF header)
  const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);
  const fakeContent = Buffer.concat([jpegHeader, randomBytes(1024)]);

  // Build multipart form
  const boundary = '----FormBoundary' + randomBytes(8).toString('hex');
  const parts = [];

  // File part
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test-passport.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
  ));
  parts.push(fakeContent);
  parts.push(Buffer.from('\r\n'));

  // Document type part
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="document_type"\r\n\r\npassport\r\n`
  ));

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  // Upload
  const uploadRes = await new Promise((resolve, reject) => {
    const r = http.request({
      hostname: 'localhost', port: 3000,
      path: `/api/cases/${caseId}/documents`,
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:3000',
        'Cookie': cookies,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let respBody = '';
      res.on('data', (c) => respBody += c);
      res.on('end', () => resolve({ status: res.statusCode, body: respBody }));
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });

  console.log('Upload status:', uploadRes.status);
  try {
    const doc = JSON.parse(uploadRes.body);
    if (doc.id) {
      console.log('Document ID:', doc.id);
      console.log('File name:', doc.file_name);
      console.log('Doc status:', doc.status);
      console.log('Doc type:', doc.document_type);
    } else {
      console.log('Response:', uploadRes.body.slice(0, 400));
    }
  } catch(e) {
    console.log('Raw:', uploadRes.body.slice(0, 400));
  }

  // List documents for the case
  const docsRes = await req({
    hostname: 'localhost', port: 3000,
    path: `/api/cases/${caseId}/documents`,
    method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Cookie': cookies }
  });

  console.log('List docs status:', docsRes.status);
  try {
    const docs = JSON.parse(docsRes.body);
    console.log('Documents count:', Array.isArray(docs) ? docs.length : 'N/A');
  } catch(e) {
    console.log('Raw:', docsRes.body.slice(0, 200));
  }
}

run().catch(e => console.error('Fatal:', e));
