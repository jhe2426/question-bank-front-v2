const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const enabled = Boolean(process.env.ADMIN_HTTP_TEST_URL);
const describeHttp = enabled ? describe : describe.skip;
if (enabled) process.env.REACT_APP_API_DOMAIN = process.env.ADMIN_HTTP_TEST_URL;
jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));
// Only unrelated main-page catalog requests are stubbed; killer requests use real Axios/HTTP.
jest.mock('../../../apis', () => ({
    ...jest.requireActual('../../../apis'),
    getUnitAndChapterListRequest: async () => ({ code: 'SU', units: [] }),
    getPastExamRoundListRequest: async () => ({ code: 'SU', pastExamRounds: [] })
}));
const React = require('react');
const { MemoryRouter, Route, Routes, Link } = require('react-router');
const { render, screen, within, fireEvent, cleanup } = require('@testing-library/react');
require('@testing-library/jest-dom');
const Main = require('../../Main').default;
const Exam = require('./index').default;
const { useAuthStore } = require('../../../stores');
const axios = require('axios');
const records = async () => (await axios.get(`${process.env.ADMIN_HTTP_TEST_URL}/__test/requests`)).data.filter(call => call.path === '/api/v1/killer-exam');
const open = (path = '/main') => render(<MemoryRouter initialEntries={[path]}>
    <Link to='/main'>테스트 메인으로</Link>
    <Routes><Route path='/main' element={<Main />} /><Route path='/killer-exam' element={<Exam />} /></Routes>
</MemoryRouter>);
const seed = () => localStorage.setItem('examData', JSON.stringify({
    type: 'killer', saveAt: Date.now(), examInfo: { type: 'killer', title: '킬러문제' }, sessionId: 2,
    questionList: [{ questionId: 1, questionOrder: 1, questionText: '이전 저장 문제', option1: 'A', option2: 'B', option3: 'C', option4: 'D' }],
    selectedAnswers: { 1: { answer: 2, questionOrder: 1 } }
}));
const start = () => {
    fireEvent.click(within(screen.getByRole('group', { name: '시험 유형' })).getByRole('button', { name: /킬러문제/ }));
    fireEvent.click(screen.getByRole('button', { name: '킬러문제 풀기' }));
};

describeHttp('killer exam start always fetches new server questions', () => {
    beforeEach(() => { localStorage.clear(); useAuthStore.getState().setAccessToken('test-admin'); jest.spyOn(window, 'alert').mockImplementation(() => {}); });
    afterEach(() => { cleanup(); localStorage.clear(); jest.restoreAllMocks(); });
    test('two actual start-button clicks make two HTTP requests despite cached questions', async () => {
        seed();
        const before = (await records()).length;
        open();
        start();
        const first = await screen.findByRole('heading', { name: /새 출제 문제/ });
        const firstText = first.textContent;
        expect(screen.queryByText('이전 저장 문제')).not.toBeInTheDocument();
        expect((await records()).length - before).toBe(1);
        const firstSaved = JSON.parse(localStorage.getItem('examData'));
        expect(firstSaved.sessionId).toBe(3);
        fireEvent.click(screen.getAllByRole('radio')[1]);
        expect(screen.getAllByRole('radio').some(input => input.checked)).toBe(true);
        fireEvent.click(screen.getByRole('link', { name: '테스트 메인으로' }));
        start();
        const second = await screen.findByRole('heading', { name: /새 출제 문제/ });
        expect(second.textContent).not.toBe(firstText);
        expect((await records()).length - before).toBe(2);
        expect(screen.getAllByRole('radio').every(input => !input.checked)).toBe(true);
        const latest = JSON.parse(localStorage.getItem('examData'));
        expect(latest.questionList[0].questionId).not.toBe(firstSaved.questionList[0].questionId);
    });
    test('server failure shows error rather than old questions; retry sends another request', async () => {
        seed();
        useAuthStore.getState().setAccessToken('test-server-error');
        const before = (await records()).length;
        open('/killer-exam');
        await screen.findByRole('alert');
        expect(screen.queryByText('이전 저장 문제')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
        await screen.findByRole('alert');
        expect((await records()).length - before).toBe(2);
    });
    test('malformed old storage cannot stop new killer question request', async () => {
        localStorage.setItem('examData', '{invalid');
        open('/killer-exam');
        expect(await screen.findByRole('heading', { name: /새 출제 문제/ })).toBeInTheDocument();
    });
});
