import http from 'k6/http';
import { check, sleep } from 'k6';

// Read pre-seeded credentials if available, or fallback to defaults
const credentials = JSON.parse(open('./test-credentials.json'));

export const options = {
  scenarios: {
    ten_users: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.01'],    // Error rate must be below 1%
  },
};

const BASE_URL = credentials.baseUrl || 'http://localhost:5050';
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': `Bearer ${credentials.token}`,
  'X-DocuMind-Client': 'k6-load-agent',
};

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, { 'health status is 200': (r) => r.status === 200 });

  // 2. Document listing
  const docsRes = http.get(`${BASE_URL}/api/documents`, { headers: HEADERS });
  check(docsRes, { 'docs listing status is 200': (r) => r.status === 200 });

  // 3. Document metadata
  if (credentials.documentId) {
    const metaRes = http.get(`${BASE_URL}/api/documents/${credentials.documentId}`, { headers: HEADERS });
    check(metaRes, { 'doc metadata status is 200': (r) => r.status === 200 });

    // 4. RAG Chat query
    const payload = JSON.stringify({ content: 'What is the monthly query volume?' });
    const chatRes = http.post(`${BASE_URL}/api/documents/${credentials.documentId}/messages`, payload, {
      headers: HEADERS,
    });
    check(chatRes, { 'chat message status is 201': (r) => r.status === 201 });
  }

  sleep(1);
}
