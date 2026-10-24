import React from 'react';
import { fireEvent, render, screen, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuestionList from './QuestionList';
import { deleteAdminQuestionRequest, getAdminQuestionDetailRequest, getAdminQuestionsRequest, getPastExamRoundListRequest, putAdminQuestionRequest } from 'src/apis';
import { parseAdminQuestionPage } from 'src/apis/dto/response/admin/question-list';

jest.mock('src/apis', () => ({ getAdminQuestionsRequest: jest.fn(), getPastExamRoundListRequest: jest.fn(), getAdminQuestionDetailRequest: jest.fn(), putAdminQuestionRequest: jest.fn(), deleteAdminQuestionRequest: jest.fn() }));
jest.mock('src/stores', () => ({ useAuthStore: () => ({ accessToken: 'test-token' }) }));
const request = getAdminQuestionsRequest as jest.Mock;
const detailRequest = getAdminQuestionDetailRequest as jest.Mock;
const updateRequest = putAdminQuestionRequest as jest.Mock;
const deleteRequest = deleteAdminQuestionRequest as jest.Mock;
const row = { questionId: 71, questionType: '기출문제', questionText: '등록된 문제 지문', difficulty: '중', imageUrl: null, sectionId: 111, pastExamRound: 39, questionOrder: 1 };
const response = { code: 'SU', questions: [row], totalElements: 21, totalPages: 2, page: 0, size: 20, last: false };
beforeEach(() => { request.mockReset(); detailRequest.mockReset(); updateRequest.mockReset(); deleteRequest.mockReset(); URL.createObjectURL = jest.fn((file: Blob | MediaSource) => `blob:${(file as File).name}`); URL.revokeObjectURL = jest.fn(); (getPastExamRoundListRequest as jest.Mock).mockReset().mockResolvedValue({ code: 'SU', pastExamRounds: [{ pastExamId: 7, pastExamRound: 39 }, { pastExamId: 8, pastExamRound: 40 }] }); });

test('queries only on click and pages by the submitted round, with edit actions available', async () => {
    request.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, page: 1, last: true });
    render(<QuestionList />);
    await screen.findByRole('option', { name: '39회' });
    expect(request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('기출 회차'), { target: { value: '39' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await screen.findByText('등록된 문제 지문');
    expect(request).toHaveBeenLastCalledWith({ questionType: '기출문제', pastExamRound: 39 }, 0, 'test-token');
    expect(screen.getByRole('button', { name: '수정' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await screen.findByText('전체 21문제 · 2 / 2 페이지');
    expect(request).toHaveBeenLastCalledWith({ questionType: '기출문제', pastExamRound: 39 }, 1, 'test-token');
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('모의고사'));
    expect(screen.queryByText('등록된 문제 지문')).not.toBeInTheDocument();
});

test('mock exam query excludes round and distinguishes empty results from errors', async () => {
    request.mockResolvedValueOnce({ ...response, questions: [], totalElements: 0, totalPages: 0, last: true }).mockRejectedValueOnce(new Error('서버 조회 오류'));
    render(<QuestionList />);
    await screen.findByRole('option', { name: '39회' });
    fireEvent.click(screen.getByLabelText('모의고사'));
    fireEvent.change(screen.getByLabelText('난이도'), { target: { value: '상' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await screen.findByText('등록된 문제가 없습니다.');
    expect(request).toHaveBeenCalledWith({ questionType: '모의고사', difficulty: '상' }, 0, 'test-token');
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('서버 조회 오류');
    expect(screen.queryByText('등록된 문제가 없습니다.')).not.toBeInTheDocument();
});

test('validates round and blocks duplicate requests while loading', async () => {
    let resolve: (value: unknown) => void = () => {};
    request.mockImplementation(() => new Promise(done => { resolve = done; }));
    render(<QuestionList />);
    await screen.findByRole('option', { name: '39회' });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('등록된 기출 회차를 선택');
    fireEvent.change(screen.getByLabelText('기출 회차'), { target: { value: '39' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    fireEvent.click(screen.getByRole('button', { name: '조회 중…' }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('모의고사')).toBeDisabled();
    resolve(response);
    await waitFor(() => expect(screen.getByRole('button', { name: '조회' })).toBeEnabled());
});

test('response adapter accepts the verified backend DTO and rejects unknown contracts', () => {
    expect(parseAdminQuestionPage(response).questions[0].questionOrder).toBe(1);
    expect(() => parseAdminQuestionPage({ content: [] })).toThrow('응답 형식');
    expect(() => parseAdminQuestionPage({ ...response, totalPages: '2' })).toThrow('응답 형식');
    expect(() => parseAdminQuestionPage({ code: 'VF', message: '조건 오류' })).toThrow('조건 오류');
});


test('only server rounds are selectable, empty rounds block past search but not mock search', async () => {
    (getPastExamRoundListRequest as jest.Mock).mockResolvedValue({ code: 'SU', pastExamRounds: [] });
    render(<QuestionList />);
    await screen.findByText('등록된 기출 회차가 없습니다.');
    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
    expect(screen.getByLabelText('기출 회차')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('모의고사'));
    expect(screen.getByRole('button', { name: '조회' })).toBeEnabled();
});

test('round lookup failure is retryable and sends actual round rather than internal ID', async () => {
    (getPastExamRoundListRequest as jest.Mock).mockResolvedValueOnce({ code: 'ERR', message: '회차 조회 오류' });
    request.mockResolvedValue(response);
    render(<QuestionList />);
    expect(await screen.findByRole('alert')).toHaveTextContent('회차 조회 오류');
    fireEvent.click(screen.getByRole('button', { name: '회차 다시 불러오기' }));
    await screen.findByRole('option', { name: '39회' });
    expect(screen.queryByRole('option', { name: '7회' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('기출 회차'), { target: { value: '39' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await screen.findByText('등록된 문제 지문');
    expect(request).toHaveBeenCalledWith({ questionType: '기출문제', pastExamRound: 39 }, 0, 'test-token');
});


const detail = { code: 'SU', questionId: 71, questionType: '기출문제', sectionId: 111, difficulty: '중', questionText: '등록된 문제 지문', imageUrl: '/api/v1/file/기출문제/old.png', option1: '보기 하나', option2: '보기 둘', option3: '보기 셋', option4: '보기 넷', answer: 1, shortExplanation: '간단 해설', detailedExplanation: { content: '상세 해설', imageUrl: 'https://localhost:4000/api/v1/file/explanation/old.jpg' }, pastExamRound: 39, questionOrder: 1, tags: [] };
const openRow = async () => {
    request.mockResolvedValue(response);
    render(<QuestionList />);
    await screen.findByRole('option', { name: '39회' });
    fireEvent.change(screen.getByLabelText('기출 회차'), { target: { value: '39' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await screen.findByText('등록된 문제 지문');
};

test('loads past detail, saves edited text/answer and independently replaced images, then refreshes detail and list', async () => {
    detailRequest.mockResolvedValueOnce(detail).mockResolvedValueOnce({ ...detail, questionText: '수정된 지문', answer: 2 });
    updateRequest.mockResolvedValue({ code: 'SU' });
    await openRow();
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    const dialog = await screen.findByRole('dialog', { name: '71번 문제 상세 및 수정' });
    expect(detailRequest).toHaveBeenCalledWith(71, 39, 'test-token');
    expect(within(dialog).getByAltText('문제 이미지')).toHaveAttribute('src', '/api/v1/file/기출문제/old.png');
    expect(within(dialog).getByAltText('상세 해설 이미지')).toHaveAttribute('src', '/api/v1/file/explanation/old.jpg');
    fireEvent.change(within(dialog).getByLabelText('문제 지문'), { target: { value: '수정된 지문' } });
    fireEvent.change(within(dialog).getByLabelText('정답 번호'), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByLabelText('상세 해설'), { target: { value: '수정된 상세 해설' } });
    const replacement = new File(['png'], 'replacement.png', { type: 'image/png' });
    fireEvent.change(within(dialog).getByLabelText('문제 이미지 새 이미지 선택'), { target: { files: [replacement] } });
    expect(within(dialog).getByAltText('문제 이미지')).toHaveAttribute('src', 'blob:replacement.png');
    fireEvent.click(within(dialog).getByRole('button', { name: '변경 사항 저장' }));
    await waitFor(() => expect(updateRequest).toHaveBeenCalledTimes(1));
    const [id, body, image, explanationImage, token] = updateRequest.mock.calls[0];
    expect([id, image, explanationImage, token]).toEqual([71, replacement, null, 'test-token']);
    expect(body).toEqual(expect.objectContaining({ questionText: '수정된 지문', answer: 2, pastExamRound: 39, questionOrder: 1, tags: [], deleteQuestionImage: false, deleteExplanationImage: false, detailedExplanation: { content: '수정된 상세 해설' } }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent('문제를 수정했습니다.');
    expect(detailRequest).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:replacement.png');
});

test('image deletion flags are independent; failed save keeps editor values and files', async () => {
    detailRequest.mockResolvedValue(detail);
    updateRequest.mockRejectedValue(new Error('수정 충돌'));
    await openRow();
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    const dialog = await screen.findByRole('dialog');
    expect(detailRequest).toHaveBeenCalledWith(71, 39, 'test-token');
    fireEvent.click(within(dialog).getAllByRole('button', { name: '이미지 삭제' })[0]);
    expect(within(dialog).queryByAltText('문제 이미지')).not.toBeInTheDocument();
    expect(within(dialog).getByAltText('상세 해설 이미지')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '변경 사항 저장' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('수정 충돌');
    expect(updateRequest.mock.calls[0][1]).toEqual(expect.objectContaining({ deleteQuestionImage: true, deleteExplanationImage: false }));
    expect(within(dialog).getByLabelText('문제 지문')).toHaveValue('등록된 문제 지문');
    expect(detailRequest).toHaveBeenCalledTimes(1);
});

test('past editor hides difficulty and short explanation while preserving their existing values', async () => {
    detailRequest.mockResolvedValue({ ...detail, difficulty: null });
    updateRequest.mockResolvedValue({ code: 'SU' });
    await openRow();
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('난이도')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('간단 해설')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '변경 사항 저장' }));
    await waitFor(() => expect(updateRequest).toHaveBeenCalledTimes(1));
    expect(updateRequest.mock.calls[0][1]).toEqual(expect.objectContaining({
        difficulty: null,
        shortExplanation: '간단 해설'
    }));
});

test('deletion requires confirmation, refreshes the page, and reports a 409 failure', async () => {
    detailRequest.mockResolvedValue(detail);
    await openRow();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('복구할 수 없습니다');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(deleteRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    deleteRequest.mockRejectedValueOnce(new Error('학습 기록이 있어 삭제할 수 없습니다.')).mockResolvedValueOnce({ code: 'SU' });
    fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('학습 기록');
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }));
    await screen.findByText('문제를 삭제했습니다.');
    expect(deleteRequest).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(2);
});

test('mock detail sends tags with no past round on save', async () => {
    request.mockResolvedValue({ ...response, questions: [{ ...row, questionType: '모의고사' }] });
    detailRequest.mockResolvedValue({ ...detail, questionType: '모의고사', pastExamRound: null, questionOrder: null, tags: [35, 36] });
    updateRequest.mockResolvedValue({ code: 'SU' });
    render(<QuestionList />);
    await screen.findByRole('option', { name: '39회' });
    fireEvent.click(screen.getByLabelText('모의고사'));
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await screen.findByText('등록된 문제 지문');
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    const dialog = await screen.findByRole('dialog');
    expect(detailRequest).toHaveBeenCalledWith(71, null, 'test-token');
    fireEvent.change(within(dialog).getByLabelText('모의고사 태그'), { target: { value: '35,37' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '변경 사항 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent('문제를 수정했습니다.');
    expect(updateRequest.mock.calls[0][1]).toEqual(expect.objectContaining({ tags: [35, 37], pastExamRound: null, questionOrder: null }));
});

test('replaces only explanation image while retaining existing question image', async () => {
    detailRequest.mockResolvedValue(detail);
    updateRequest.mockResolvedValue({ code: 'SU' });
    await openRow();
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    const dialog = await screen.findByRole('dialog');
    const replacement = new File(['jpeg'], 'new-explanation.jpg', { type: 'image/jpeg' });
    fireEvent.change(within(dialog).getByLabelText('상세 해설 이미지 새 이미지 선택'), { target: { files: [replacement] } });
    expect(within(dialog).getByAltText('상세 해설 이미지')).toHaveAttribute('src', 'blob:new-explanation.jpg');
    expect(within(dialog).getByAltText('문제 이미지')).toHaveAttribute('src', '/api/v1/file/기출문제/old.png');
    fireEvent.click(within(dialog).getByRole('button', { name: '변경 사항 저장' }));
    await waitFor(() => expect(updateRequest).toHaveBeenCalledTimes(1));
    expect(updateRequest.mock.calls[0][2]).toBeNull();
    expect(updateRequest.mock.calls[0][3]).toBe(replacement);
    expect(updateRequest.mock.calls[0][1]).toEqual(expect.objectContaining({ deleteQuestionImage: false, deleteExplanationImage: false }));
});
