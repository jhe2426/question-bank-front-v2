import { buildQuestionsRequest, parseQuestionFile, validateImageFiles, validateQuestions } from './question-draft';

const valid = { sectionId: 1, questionType: '모의고사', questionText: '지문', option1: '하나', option2: '둘', option3: '셋', option4: '넷', answer: 3 };
const parse = (question = {}) => parseQuestionFile(JSON.stringify({ questions: [{ ...valid, ...question }] }));

test('parses exact DTO and serializes numeric identifiers without draft keys or original values', () => {
    const drafts = parse({ tags: '35,36,37' });
    drafts[0].questionText = '최신 지문';
    drafts[0].sectionId = '42';
    expect(validateQuestions(drafts, [])).toEqual([]);
    expect(buildQuestionsRequest(drafts).questions[0]).toMatchObject({ sectionId: 42, questionText: '최신 지문', answer: 3, tags: '35,36,37', detailedExplanation: null, imageFileName: null });
    expect(buildQuestionsRequest(drafts).questions[0]).not.toHaveProperty('key');
});

test.each(['{', '[]', '{"questions":[]}', '{"questions":[null]}', '{"questions":[{"option1":{}}]}'])('rejects invalid JSON or structure: %s', text => {
    expect(() => parseQuestionFile(text)).toThrow();
});

test.each([
    [{ questionText: ' ' }, '문제 지문'], [{ option4: '' }, '선택지 4'], [{ answer: 5 }, '정답 번호'],
    [{ sectionId: null }, '섹션 ID'], [{ sectionId: 2147483648 }, '섹션 ID'], [{ questionType: 'mock' }, '문제 유형'],
    [{ imageFileName: 'missing.png' }, 'missing.png'], [{ detailedExplanation: {} }, '상세 해설에 내용'],
    [{ detailedExplanation: { imageFileName: 'detail.png' } }, 'detail.png'],
    [{ questionType: '기출문제' }, '기출 회차 ID'], [{ questionType: '기출문제', pastExamId: 1 }, '기출문제 순서'],
    [{ tags: '35,no' }, '양의 정수'], [{ tags: '35,35' }, '중복'], [{ questionText: '가'.repeat(256) }, '255자']
])('blocks invalid registration: %j', (patch, message) => {
    expect(validateQuestions(parse(patch), [])[0].messages.join(' ')).toContain(message);
});

test('accepts image-only detail and exact past-exam IDs; requires no images when none referenced', () => {
    const drafts = parse({ questionType: '기출문제', pastExamId: 7, questionOrder: 2, detailedExplanation: { imageFileName: 'detail.png' } });
    const images = [{ file: new File(['png'], 'detail.png', { type: 'image/png' }), previewUrl: 'blob:detail' }];
    expect(validateQuestions(drafts, images)).toEqual([]);
    expect(buildQuestionsRequest(drafts).questions[0]).toMatchObject({ pastExamId: 7, questionOrder: 2, tags: null, detailedExplanation: { content: null, imageFileName: 'detail.png' } });
    expect(validateQuestions(parse(), [])).toEqual([]);
});

test('rejects duplicate, empty and unsupported image selections', () => {
    const file = new File(['png'], 'same.png', { type: 'image/png' });
    expect(validateImageFiles([file, file], [])).toContain('중복');
    expect(validateImageFiles([file], [{ file, previewUrl: 'blob:x' }])).toContain('중복');
    expect(validateImageFiles([new File([], 'empty.png')], [])).toContain('10MB');
    expect(validateImageFiles([new File(['gif'], 'file.gif')], [])).toContain('PNG');
});
