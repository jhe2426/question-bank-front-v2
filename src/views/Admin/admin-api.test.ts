import { deleteAdminQuestionRequest, getAdminQuestionDetailRequest, putAdminQuestionRequest } from 'src/apis';
import { adminImageUrl } from './admin-image-url';

jest.mock('axios', () => {
    const api = { get: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { response: { use: jest.fn() } } };
    return { __esModule: true, default: { create: () => api, isAxiosError: (error: any) => !!error?.isAxiosError }, __mockApi: api };
});
const mockApi = require('axios').__mockApi;
const mockGet = mockApi.get as jest.Mock;
const mockPut = mockApi.put as jest.Mock;
const mockDelete = mockApi.delete as jest.Mock;

const detail = { code: 'SU', questionId: 71, questionType: '모의고사', sectionId: 4, difficulty: '중', questionText: '문제', imageUrl: null,
    option1: '하나', option2: '둘', option3: '셋', option4: '넷', answer: 2, shortExplanation: null,
    detailedExplanation: null, pastExamRound: null, questionOrder: null, tags: [35] };
beforeEach(() => { mockGet.mockReset(); mockPut.mockReset(); mockDelete.mockReset(); });

test('detail and delete use exact protected paths and bearer token', async () => {
    mockGet.mockResolvedValue({ data: detail });
    mockDelete.mockResolvedValue({ data: { code: 'SU', message: 'Success.' } });
    expect(await getAdminQuestionDetailRequest(71, 39, 'jwt')).toMatchObject({ questionId: 71, answer: 2 });
    expect(mockGet).toHaveBeenCalledWith('/api/admin/questions/71', {
        headers: { Authorization: 'Bearer jwt' }, params: { pastExamRound: 39 }
    });
    await deleteAdminQuestionRequest(71, 'jwt');
    expect(mockDelete).toHaveBeenCalledWith('/api/admin/questions/71', { headers: { Authorization: 'Bearer jwt' } });
});

test('PUT sends JSON question part and only selected independent image file parts', async () => {
    mockPut.mockResolvedValue({ data: { code: 'SU', message: 'Success.' } });
    const file = new File(['image'], 'replacement.png', { type: 'image/png' });
    const question = { questionText: '새 문제', option1: '하나', option2: '둘', option3: '셋', option4: '넷', answer: 2,
        difficulty: '중' as const, sectionId: 4, shortExplanation: null, detailedExplanation: { content: '해설' },
        deleteQuestionImage: false, deleteExplanationImage: true, pastExamRound: null, questionOrder: null, tags: [35] };
    await putAdminQuestionRequest(71, question, file, null, 'jwt');
    const [path, data, config] = mockPut.mock.calls[0];
    expect(path).toBe('/api/admin/questions/71');
    expect(config).toEqual({ headers: { Authorization: 'Bearer jwt' } });
    expect(config.headers['Content-Type']).toBeUndefined();
    expect(data).toBeInstanceOf(FormData);
    expect(data.get('questionImage')).toBe(file);
    expect(data.get('explanationImage')).toBeNull();
    const body = data.get('question') as Blob;
    expect(body.type).toBe('application/json');
    const serialized = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(body);
    });
    expect(JSON.parse(serialized)).toEqual(question);
});

test('server 409 message and 404 fallback reach caller without retrying', async () => {
    mockDelete.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: '학습 기록에서 사용 중입니다.' } } });
    await expect(deleteAdminQuestionRequest(71, 'jwt')).rejects.toThrow('학습 기록에서 사용 중입니다.');
    expect(mockDelete).toHaveBeenCalledTimes(1);
    mockGet.mockRejectedValue({ isAxiosError: true, response: { status: 404, data: {} } });
    await expect(getAdminQuestionDetailRequest(71, 39, 'jwt')).rejects.toThrow('문제를 찾을 수 없습니다.');
});

test('mock detail omits the pastExamRound query parameter', async () => {
    mockGet.mockResolvedValue({ data: detail });
    await getAdminQuestionDetailRequest(100, null, 'jwt');
    expect(mockGet).toHaveBeenCalledWith('/api/admin/questions/100', {
        headers: { Authorization: 'Bearer jwt' }
    });
});

test('legacy past detail accepts a missing difficulty so an admin can repair it', async () => {
    mockGet.mockResolvedValue({ data: { ...detail, questionType: '기출문제', difficulty: null, pastExamRound: 39, questionOrder: 1, tags: [] } });
    const response = await getAdminQuestionDetailRequest(71, 39, 'jwt');
    expect(response.difficulty).toBeNull();
});

test('relative and legacy localhost file URLs use the current API routing', () => {
    expect(adminImageUrl('/api/v1/file/기출문제/q.png')).toBe('/api/v1/file/기출문제/q.png');
    expect(adminImageUrl('https://localhost:4000/api/v1/file/explanation/e.png')).toBe('/api/v1/file/explanation/e.png');
    expect(adminImageUrl('https://example.org/api/v1/file/모의고사/q.png')).toBe(new URL('https://example.org/api/v1/file/모의고사/q.png').href);
});
