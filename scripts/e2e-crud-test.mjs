import http from 'http';

function request(opts, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // Step 1: Login to get session cookies
  const loginData = JSON.stringify({
    email: 'e2e-test-attorney@casefill.ai',
    password: 'TestPass123Secure'
  });

  const loginRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length, 'Origin': 'http://localhost:3000' }
  }, loginData);

  console.log('1. Login status:', loginRes.status);

  // Extract cookies from login response
  const cookies = loginRes.headers['set-cookie'] || [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
  console.log('   Cookies received:', cookies.length);

  if (loginRes.status !== 200) {
    console.log('   Login failed:', loginRes.body.slice(0, 200));
    return;
  }

  // Step 2: Create a firm
  const firmData = JSON.stringify({ name: 'E2E Test Law Firm' });
  const firmRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/firms',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': firmData.length, 'Origin': 'http://localhost:3000', 'Cookie': cookieStr }
  }, firmData);

  console.log('2. Create firm status:', firmRes.status);
  const firm = JSON.parse(firmRes.body);
  if (firm.success) {
    console.log('   Firm ID:', firm.data?.id);
    console.log('   Firm name:', firm.data?.name);
  } else {
    console.log('   Response:', firmRes.body.slice(0, 300));
  }

  const firmId = firm.data?.id;

  // Step 3: Create a case (API expects snake_case, visa_type uses enum values like H1B)
  const caseData = JSON.stringify({
    title: 'E2E Test H1B Application',
    visa_type: 'H1B',
    client_id: '476ee8f8-095d-45a3-be51-35f1fa59439f',
    description: 'E2E test case for H-1B visa application',
    firm_id: firmId
  });
  const caseRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/cases',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': caseData.length, 'Origin': 'http://localhost:3000', 'Cookie': cookieStr }
  }, caseData);

  console.log('3. Create case status:', caseRes.status);
  try {
    const caseResult = JSON.parse(caseRes.body);
    const caseId = caseResult.data?.id || caseResult.id;
    if (caseId) {
      console.log('   Case ID:', caseId);
      console.log('   Case title:', caseResult.data?.title || caseResult.title);
    } else {
      console.log('   Response:', caseRes.body.slice(0, 400));
    }
  } catch (_e) {
    console.log('   Raw response:', caseRes.body.slice(0, 400));
  }

  // Step 4: List cases
  const listRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/cases',
    method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Cookie': cookieStr }
  });

  console.log('4. List cases status:', listRes.status);
  try {
    const cases = JSON.parse(listRes.body);
    console.log('   Response keys:', Object.keys(cases));
    console.log('   Cases:', cases.cases?.length ?? 'N/A');
    console.log('   Data:', cases.data?.length ?? 'N/A');
    console.log('   Total:', cases.total ?? 'N/A');
    if (cases.cases?.length > 0) {
      console.log('   First case:', cases.cases[0]?.title);
    } else if (cases.data?.length > 0) {
      console.log('   First case:', cases.data[0]?.title);
    }
    console.log('   Full response:', JSON.stringify(cases).slice(0, 400));
  } catch (_e) {
    console.log('   Raw:', listRes.body.slice(0, 300));
  }

  // Step 5: Get case stats
  const statsRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/cases/stats',
    method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Cookie': cookieStr }
  });

  console.log('5. Case stats status:', statsRes.status);
  try {
    const stats = JSON.parse(statsRes.body);
    console.log('   Stats:', JSON.stringify(stats.data || stats).slice(0, 200));
  } catch (_e) {
    console.log('   Raw:', statsRes.body.slice(0, 200));
  }

  // Step 6: Get firms
  const firmsListRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/firms',
    method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Cookie': cookieStr }
  });

  console.log('6. List firms status:', firmsListRes.status);
  try {
    const firms = JSON.parse(firmsListRes.body);
    console.log('   Firms count:', firms.data?.length || 0);
  } catch (_e) {
    console.log('   Raw:', firmsListRes.body.slice(0, 200));
  }

  console.log('\n--- E2E CRUD Test Complete ---');
}

run().catch(e => console.error('Fatal error:', e.message));
