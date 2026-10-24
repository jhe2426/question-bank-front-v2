const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const enabled = Boolean(process.env.ADMIN_HTTP_TEST_URL);
const describeHttp = enabled ? describe : describe.skip;
if (enabled) process.env.REACT_APP_API_DOMAIN = process.env.ADMIN_HTTP_TEST_URL;
jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));
const React = require('react');
const { MemoryRouter } = require('react-router');
const { render, screen, fireEvent, cleanup } = require('@testing-library/react');
require('@testing-library/jest-dom');
const AdminPage = require('./AdminPage').default;
const { useAuthStore } = require('../../stores');
const axios = require('axios');
const records = async () => (await axios.get(`${process.env.ADMIN_HTTP_TEST_URL}/__test/requests`)).data.filter(call => call.path === '/api/v1/auth/approval-code');
const open = () => render(<MemoryRouter initialEntries={['/admin/approvals']}><AdminPage /></MemoryRouter>);

describeHttp('approval SMS form over real HTTP, without sending real SMS', () => {
    beforeEach(() => useAuthStore.getState().setAccessToken('test-admin'));
    afterEach(cleanup);
    test('sends exact phoneNumber body once on click and displays confirmed success', async () => {
        const before = (await records()).length;
        open();
        fireEvent.change(screen.getByLabelText('수신 전화번호'), { target: { value: '010-2222-2222' } });
        expect((await records()).length).toBe(before);
        const button = screen.getByRole('button', { name: '승인번호 발송' });
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.submit(button.closest('form'));
        expect(screen.getByRole('button', { name: '발송 중…' })).toBeDisabled();
        expect(screen.getByLabelText('수신 전화번호')).toBeDisabled();
        expect(await screen.findByRole('status')).toHaveTextContent('01022222222로 승인번호를 발송했습니다.');
        const calls = (await records()).slice(before);
        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/auth/approval-code', headers: { authorization: 'Bearer test-admin' } });
        expect(JSON.parse(calls[0].raw)).toEqual({ phoneNumber: '01022222222' });
        expect(screen.getByRole('button', { name: '승인번호 발송' })).toBeEnabled();
    });
    test('blank or invalid phone number blocks the request', async () => {
        const before = (await records()).length;
        open();
        fireEvent.click(screen.getByRole('button', { name: '승인번호 발송' }));
        expect(screen.getByRole('alert')).toHaveTextContent('숫자 11자리');
        fireEvent.change(screen.getByLabelText('수신 전화번호'), { target: { value: '01022abc222' } });
        fireEvent.click(screen.getByRole('button', { name: '승인번호 발송' }));
        expect(screen.getByRole('alert')).toHaveTextContent('숫자 11자리');
        expect((await records()).length).toBe(before);
    });
    test('server SMS failure displays its error and preserves recipient', async () => {
        useAuthStore.getState().setAccessToken('test-server-error');
        open();
        fireEvent.change(screen.getByLabelText('수신 전화번호'), { target: { value: '01022222222' } });
        fireEvent.click(screen.getByRole('button', { name: '승인번호 발송' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to send verification code via SMS');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByLabelText('수신 전화번호')).toHaveValue('01022222222');
        expect(screen.getByRole('button', { name: '승인번호 발송' })).toBeEnabled();
    });
});
