// Opt-in contract tests using the real Axios XHR adapter and local Postman simulation.
const enabled = Boolean(process.env.ADMIN_HTTP_TEST_URL);
const describeHttp = enabled ? describe : describe.skip;
if (enabled) process.env.REACT_APP_API_DOMAIN = process.env.ADMIN_HTTP_TEST_URL;
jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));
const { getAdminCheckRequest } = require('../../apis');
const { useAuthStore } = require('../../stores');
const axios = require('axios');
const records = async () => (await axios.get(`${process.env.ADMIN_HTTP_TEST_URL}/__test/requests`)).data;

describeHttp('admin permission check over actual HTTP', () => {
    beforeEach(() => useAuthStore.getState().setAccessToken('test-admin'));
    afterEach(() => { document.cookie = 'csrfToken=; Max-Age=0; path=/'; });
    test('calls protected GET endpoint with bearer token and accepts real 200 success', async () => {
        expect(await getAdminCheckRequest('test-admin')).toBe(200);
        const calls = await records();
        expect(calls[calls.length - 1]).toMatchObject({ method: 'GET', path: '/api/admin/check', headers: { authorization: 'Bearer test-admin' } });
    });
    test.each([['test-forbidden', 403], ['test-server-error', 500], ['test-not-deployed', 404], ['test-html', null]])('fails closed for %s', async (token, expected) => {
        expect(await getAdminCheckRequest(token)).toBe(expected);
    });
    test('reuses refresh interceptor and CSRF before retrying permission check', async () => {
        document.cookie = 'csrfToken=test-csrf; path=/';
        useAuthStore.getState().setAccessToken('test-expired');
        expect(await getAdminCheckRequest('test-expired')).toBe(200);
        const calls = (await records()).slice(-3);
        expect(calls.map(call => call.path)).toEqual(['/api/admin/check', '/api/v1/auth/refresh', '/api/admin/check']);
        expect(calls[1].headers['x-csrf-token']).toBe('test-csrf');
        expect(calls[2].headers.authorization).toBe('Bearer test-refreshed');
    });
    test('a second 401 after refresh ends verification instead of refreshing forever', async () => {
        document.cookie = 'csrfToken=test-csrf; path=/';
        useAuthStore.getState().setAccessToken('test-repeat-401');
        const before = (await records()).length;
        expect(await getAdminCheckRequest('test-repeat-401')).toBe(401);
        const calls = (await records()).slice(before);
        expect(calls.map(call => call.path)).toEqual(['/api/admin/check', '/api/v1/auth/refresh', '/api/admin/check']);
    });
});
