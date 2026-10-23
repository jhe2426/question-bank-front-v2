// Opt-in real HTTP integration: start postman/simulations/admin-questions.sim.yaml first.
const enabled = Boolean(process.env.ADMIN_HTTP_TEST_URL);
const describeHttp = enabled ? describe : describe.skip;
if (enabled) process.env.REACT_APP_API_DOMAIN = process.env.ADMIN_HTTP_TEST_URL;
// Use Axios's shipped CJS browser build so CRA/Jest loads the actual XHR adapter.
jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));
const { postAdminQuestionsRequest } = require('../../apis');
const { useAuthStore } = require('../../stores');
const axios = require('axios');
const { buildQuestionsRequest, parseQuestionFile } = require('./question-draft');
const origin = process.env.ADMIN_HTTP_TEST_URL;
const draft = () => {
  const questions = parseQuestionFile(JSON.stringify({ questions: [{ sectionId: 1, questionType: '모의고사', questionText: '원본', option1: 'A', option2: 'B', option3: 'C', option4: 'D', answer: 1 }] }));
  questions[0].questionText = '최신 편집 지문';
  questions[0].answer = '3';
  return buildQuestionsRequest(questions);
};
const records = async () => (await axios.get(`${origin}/__test/requests`)).data;

describeHttp('actual Axios multipart contract over local HTTP', () => {
  beforeEach(() => { useAuthStore.getState().setAccessToken('test-admin'); });
  test('sends edited JSON under jsonFile, repeated images and bearer header', async () => {
    const response = await postAdminQuestionsRequest(draft(), [new File(['png-data'], 'question.png', { type: 'image/png' }), new File(['jpg-data'], 'detail.jpg', { type: 'image/jpeg' })], 'test-admin');
    expect(response).toEqual({ code: 'SU', message: 'Success.' });
    const calls = await records();
    const request = calls[calls.length - 1];
    expect(request.path).toBe('/api/admin/questions');
    expect(request.headers.authorization).toBe('Bearer test-admin');
    expect(request.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(request.raw).toContain('name="jsonFile"; filename="questions.json"');
    expect(request.raw).toContain('Content-Type: application/json');
    expect(request.raw).toContain(JSON.stringify(draft()));
    expect(request.raw).not.toContain('"questionText":"원본"');
    expect(request.raw.match(/name="images"/g)).toHaveLength(2);
    expect(request.raw).toContain('filename="question.png"');
    expect(request.raw).toContain('filename="detail.jpg"');
  });
  test('sends no images part when there are no images', async () => {
    expect((await postAdminQuestionsRequest(draft(), [], 'test-admin')).code).toBe('SU');
    const calls = await records();
    expect(calls[calls.length - 1].raw).not.toContain('name="images"');
  });
  test('preserves server errors and provides fallback for empty forbidden responses', async () => {
    expect(await postAdminQuestionsRequest(draft(), [], 'test-server-error')).toEqual({ code: 'ISE', message: 'Server error.' });
    expect(await postAdminQuestionsRequest(draft(), [], 'test-forbidden')).toEqual({ code: 'HTTP_403', message: '관리자 권한이 필요합니다.' });
  });
  test('existing interceptor refreshes with CSRF and retries identical multipart using new token', async () => {
    document.cookie = 'csrfToken=test-csrf; path=/';
    useAuthStore.getState().setAccessToken('test-expired');
    const response = await postAdminQuestionsRequest(draft(), [new File(['png'], 'retry.png', { type: 'image/png' })], 'test-expired');
    expect(response.code).toBe('SU');
    expect(useAuthStore.getState().accessToken).toBe('test-refreshed');
    const calls = (await records()).slice(-3);
    expect(calls.map(call => call.path)).toEqual(['/api/admin/questions', '/api/v1/auth/refresh', '/api/admin/questions']);
    expect(calls[1].headers['x-csrf-token']).toBe('test-csrf');
    expect(calls[2].headers.authorization).toBe('Bearer test-refreshed');
    expect(calls[2].raw).toContain(JSON.stringify(draft()));
    expect(calls[2].raw).toContain('filename="retry.png"');
    document.cookie = 'csrfToken=; Max-Age=0; path=/';
  });
});
