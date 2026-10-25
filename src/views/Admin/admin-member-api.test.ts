import { getAdminMemberLearningSummaryRequest, getAdminMembersRequest } from 'src/apis';

jest.mock('axios', () => {
    const api = { get: jest.fn(), interceptors: { response: { use: jest.fn() } } };
    return { __esModule: true, default: { create: () => api, isAxiosError: (error: any) => !!error?.isAxiosError }, __mockApi: api };
});
const mockGet = require('axios').__mockApi.get as jest.Mock;

const listResponse = {
    code: 'SU', message: 'Success.', users: [{ userId: 'member/a', userName: '회원', phoneNumber: '010-1111-2222' }],
    totalElements: 1, totalPages: 1, page: 0, size: 20, last: true
};
const detailResponse = {
    code: 'SU', message: 'Success.', userId: 'member/a', userName: '회원', phoneNumber: '010-1111-2222',
    totalSolvedCount: 3, totalSolveSeconds: null,
    sectionSummaries: [{ sectionId: 1, sectionName: '데이터의 이해', solvedCount: 3, correctCount: 2, accuracyRate: 66.666666 }]
};

beforeEach(() => mockGet.mockReset());

test('member list uses keyword and fixed 20-item paging with bearer authentication', async () => {
    mockGet.mockResolvedValue({ data: listResponse });
    await expect(getAdminMembersRequest(' 회원 ', 0, 'jwt')).resolves.toMatchObject({ totalElements: 1 });
    expect(mockGet).toHaveBeenCalledWith('/api/admin/users', {
        headers: { Authorization: 'Bearer jwt' }, params: { keyword: '회원', page: 0, size: 20 }
    });
});

test('empty list keyword is omitted and detail safely encodes the selected user id', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...listResponse, users: [], totalElements: 0, totalPages: 0 } })
        .mockResolvedValueOnce({ data: detailResponse });
    await getAdminMembersRequest('  ', 0, 'jwt');
    expect(mockGet).toHaveBeenNthCalledWith(1, '/api/admin/users', {
        headers: { Authorization: 'Bearer jwt' }, params: { page: 0, size: 20 }
    });
    await expect(getAdminMemberLearningSummaryRequest('member/a', 'jwt')).resolves.toMatchObject({
        totalSolveSeconds: null,
        sectionSummaries: [{ correctCount: 2, accuracyRate: 66.666666 }]
    });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/api/admin/users/member%2Fa/learning-summary', {
        headers: { Authorization: 'Bearer jwt' }
    });
});

test('member errors expose status-specific fallbacks and invalid success DTOs are rejected', async () => {
    mockGet.mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, data: {} } })
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 404, data: {} } })
        .mockResolvedValueOnce({ data: { ...detailResponse, totalSolveSeconds: '123' } });
    await expect(getAdminMembersRequest('', 0, 'jwt')).rejects.toThrow('관리자 권한이 필요합니다.');
    await expect(getAdminMemberLearningSummaryRequest('missing', 'jwt')).rejects.toThrow('회원을 찾을 수 없습니다.');
    await expect(getAdminMemberLearningSummaryRequest('member/a', 'jwt')).rejects.toThrow('회원 학습 현황 응답 형식을 확인할 수 없습니다.');
});

test('learning summary rejects missing or out-of-range accuracy fields', async () => {
    const section = detailResponse.sectionSummaries[0];
    mockGet.mockResolvedValueOnce({ data: {
        ...detailResponse,
        sectionSummaries: [{ sectionId: section.sectionId, sectionName: section.sectionName, solvedCount: section.solvedCount }]
    } }).mockResolvedValueOnce({ data: {
        ...detailResponse,
        sectionSummaries: [{ ...section, accuracyRate: 101 }]
    } }).mockResolvedValueOnce({ data: {
        ...detailResponse,
        sectionSummaries: [{ ...section, correctCount: section.solvedCount + 1 }]
    } });

    await expect(getAdminMemberLearningSummaryRequest('member/a', 'jwt')).rejects.toThrow('회원 학습 현황 응답 형식을 확인할 수 없습니다.');
    await expect(getAdminMemberLearningSummaryRequest('member/a', 'jwt')).rejects.toThrow('회원 학습 현황 응답 형식을 확인할 수 없습니다.');
    await expect(getAdminMemberLearningSummaryRequest('member/a', 'jwt')).rejects.toThrow('회원 학습 현황 응답 형식을 확인할 수 없습니다.');
});
