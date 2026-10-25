const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const React = require('react');
const { cleanup, fireEvent, render, screen, waitFor, within } = require('@testing-library/react');
require('@testing-library/jest-dom');
const { MemoryRouter, Route, Routes } = require('react-router');
const { getPastExamQuestionListRequest } = require('src/apis');
const { useAuthStore } = require('src/stores');
const Exam = require('./index').default;

jest.mock('src/apis', () => ({
    getPastExamQuestionListRequest: jest.fn(),
    getKillerExamQuestionListRequest: jest.fn(),
    getMockExamQuestionListRequest: jest.fn(),
    getIncorrectQuestionListRequest: jest.fn(),
    postIncorrectQuestionGradingReuqest: jest.fn(),
    postKillerExamGradingRequest: jest.fn(),
    postMockExamGradingRequest: jest.fn(),
    postPastExamGradingRequest: jest.fn()
}));

const pastRequest = getPastExamQuestionListRequest as jest.Mock;
const question = (questionId: number, questionOrder: number) => ({
    questionId,
    questionOrder,
    questionText: `${questionOrder}번 지문`,
    option1: '보기 1',
    option2: '보기 2',
    option3: '보기 3',
    option4: '보기 4'
});

describe('기출문제 시험 화면 페이지 이동', () => {
    beforeEach(() => {
        useAuthStore.getState().setAccessToken('test-token');
        Element.prototype.scrollIntoView = jest.fn();
    });

    afterEach(() => {
        cleanup();
        jest.clearAllMocks();
        useAuthStore.getState().clearAuth();
    });

    test('관리자 지정 번호로 정렬하고 실제 배열 인덱스로 페이지를 이동한다', async () => {
        pastRequest.mockResolvedValue({
            code: 'SU',
            message: 'Success.',
            questions: [question(104, 80), question(102, 38), question(101, 35), question(103, 41)]
        });

        render(
            <MemoryRouter initialEntries={['/past-exam/7/38']}>
                <Routes><Route path='/past-exam/:pastExamId/:pastExamRound' element={<Exam />} /></Routes>
            </MemoryRouter>
        );

        expect(await screen.findByText('35번 지문')).toBeInTheDocument();
        expect(screen.getByText('38번 지문')).toBeInTheDocument();
        expect(screen.getByText('41번 지문')).toBeInTheDocument();
        expect(screen.queryByText('80번 지문')).not.toBeInTheDocument();
        expect(screen.getByLabelText('1 / 2 페이지')).toHaveTextContent('1 / 2');

        fireEvent.click(within(screen.getByRole('complementary', { name: '시험 진행 정보' })).getByRole('button', { name: '80번 문제로 이동' }));

        await waitFor(() => expect(screen.getByLabelText('2 / 2 페이지')).toHaveTextContent('2 / 2'));
        expect(screen.getByText('80번 지문')).toBeInTheDocument();
        expect(screen.queryByText('35번 지문')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '다음 문제' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '이전 문제' })).toBeEnabled();
    });

    test('35번과 38번만 있어도 1 / 1 페이지를 유지한다', async () => {
        pastRequest.mockResolvedValue({
            code: 'SU',
            message: 'Success.',
            questions: [question(102, 38), question(101, 35)]
        });

        render(
            <MemoryRouter initialEntries={['/past-exam/7/38']}>
                <Routes><Route path='/past-exam/:pastExamId/:pastExamRound' element={<Exam />} /></Routes>
            </MemoryRouter>
        );

        expect(await screen.findByText('35번 지문')).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('complementary', { name: '시험 진행 정보' })).getByRole('button', { name: '38번 문제로 이동' }));

        expect(screen.getByLabelText('1 / 1 페이지')).toHaveTextContent('1 / 1');
        expect(screen.getByRole('button', { name: '이전 문제' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '다음 문제' })).toBeDisabled();
    });
});

