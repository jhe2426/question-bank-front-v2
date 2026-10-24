// Local contract fixture: AdminQuestionController, AdminQuestionDto and ResponseDto.
// Synthetic tokens select test outcomes; this server never persists real questions.
const http = require('http');
const requests = [];
let killerRequestCount = 0;
let rejectRefreshedCheck = false;
function readBody(req) {
  if (req.body !== undefined) return Promise.resolve(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-CSRF-TOKEN');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') return send(204, null);
  // Harness-only inspection route, not a production API.
  if (req.method === 'GET' && req.url === '/__test/requests') return send(200, requests);
  const raw = await readBody(req);
  requests.push({ method: req.method, path: req.url, headers: req.headers, raw });
  // KillerExamController/GetKillerExamQuestionListResponseDto contract.
  // Deterministic changing fixtures verify refetching, not server randomness.
  if (req.method === 'GET' && req.url === '/api/v1/killer-exam') {
    if (req.headers.authorization === 'Bearer test-server-error') return send(500, { code: 'ISE', message: 'Server error.' });
    const questionId = 9000 + ++killerRequestCount;
    return send(200, { code: 'SU', message: 'Success.', sessionId: 3, questions: [{
      questionId, questionOrder: 1, questionText: `새 출제 문제 ${questionId}`,
      option1: '첫 번째 보기', option2: '두 번째 보기', option3: '세 번째 보기', option4: '네 번째 보기', imageUrl: null, shortExplanation: null
    }] });
  }
  if (req.method === 'POST' && req.url === '/api/v1/auth/refresh') {
    if (req.headers['x-csrf-token'] !== 'test-csrf') return send(403, { code: 'VF', message: 'Validation failed.' });
    return send(200, { code: 'SU', message: 'Success.', accessToken: 'test-refreshed' });
  }
  // AdminController + existing Spring Security /api/admin/** role rule.
  if (req.method === 'GET' && req.url === '/api/admin/check') {
    const token = req.headers.authorization;
    if (token === 'Bearer test-repeat-401') {
      rejectRefreshedCheck = true;
      return send(401, { code: 'AF', message: 'Authentication failed.' });
    }
    if (token === 'Bearer test-refreshed' && rejectRefreshedCheck) {
      rejectRefreshedCheck = false;
      return send(401, { code: 'AF', message: 'Authentication failed.' });
    }
    if (token === 'Bearer test-expired') return send(401, { code: 'AF', message: 'Authentication failed.' });
    if (token === 'Bearer test-forbidden') { res.writeHead(403); return res.end(); }
    if (token === 'Bearer test-server-error') return send(500, { code: 'ISE', message: 'Server error.' });
    // Deployment/proxy failure fixtures, not valid controller responses.
    if (token === 'Bearer test-not-deployed') return send(404, {});
    if (token === 'Bearer test-html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html>SPA fallback</html>'); }
    if (['Bearer test-admin', 'Bearer test-refreshed'].includes(token)) return send(200, { code: 'SU', message: 'Success.' });
    return send(401, { code: 'AF', message: 'Authentication failed.' });
  }
  if (req.method === 'POST' && req.url === '/api/admin/questions') {
    const token = req.headers.authorization;
    if (token === 'Bearer test-expired') return send(401, { code: 'AF', message: 'Authentication failed.' });
    if (token === 'Bearer test-server-error') return send(500, { code: 'ISE', message: 'Server error.' });
    if (token === 'Bearer test-forbidden') { res.writeHead(403); return res.end(); }
    if (!['Bearer test-admin', 'Bearer test-refreshed'].includes(token)) return send(401, { code: 'AF', message: 'Authentication failed.' });
    return send(201, { code: 'SU', message: 'Success.' });
  }
  return send(501, { message: 'This contract fixture does not model this endpoint.' });
}).listen(process.env.PORT || 4911);
