import { connectQuestionImages, findSelectedImage, buildQuestionsRequest, parseQuestionFile, validateImageFiles, validateQuestions } from './question-draft';

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
    [{ questionType: '기출문제' }, '기출 회차'], [{ questionType: '기출문제', pastExamRound: 1 }, '기출문제 순서'],
    [{ tags: '35,no' }, '양의 정수'], [{ tags: '35,35' }, '중복'], [{ questionText: '가'.repeat(256) }, '255자']
])('blocks invalid registration: %j', (patch, message) => {
    expect(validateQuestions(parse(patch), [])[0].messages.join(' ')).toContain(message);
});

test('accepts image-only detail and numeric past-exam rounds; requires no images when none referenced', () => {
    const drafts = parse({ questionType: '기출문제', pastExamRound: 7, questionOrder: 2, detailedExplanation: { imageFileName: 'detail.png' } });
    const images = [{ file: new File(['png'], 'detail.png', { type: 'image/png' }), previewUrl: 'blob:detail' }];
    expect(validateQuestions(drafts, images)).toEqual([]);
    expect(buildQuestionsRequest(drafts).questions[0]).toMatchObject({ pastExamRound: 7, questionOrder: 2, tags: null, detailedExplanation: { content: null, imageFileName: 'detail.png' } });
    expect(validateQuestions(parse(), [])).toEqual([]);
});

test('rejects duplicate, empty and unsupported image selections', () => {
    const file = new File(['png'], 'same.png', { type: 'image/png' });
    expect(validateImageFiles([file, file], [])).toContain('중복');
    expect(validateImageFiles([file], [{ file, previewUrl: 'blob:x' }])).toContain('중복');
    expect(validateImageFiles([new File([], 'empty.png')], [])).toContain('10MB');
    expect(validateImageFiles([new File(['gif'], 'file.gif')], [])).toContain('PNG');
});


test('legacy pastExamId is never interpreted as a round or included in the request', () => {
    const drafts = parse({ questionType: '기출문제', pastExamId: 123, questionOrder: 5 });
    expect(drafts[0].pastExamRound).toBeNull();
    expect(drafts[0]).not.toHaveProperty('pastExamId');
    expect(validateQuestions(drafts, [])[0].messages.join(' ')).toContain('pastExamRound');
    drafts[0].pastExamRound = 39;
    expect(validateQuestions(drafts, [])).toEqual([]);
    const request = buildQuestionsRequest(drafts);
    expect(request.questions[0]).toMatchObject({ pastExamRound: 39, questionOrder: 5 });
    expect(JSON.stringify(request)).not.toContain('pastExamId');
});

test.each([null, 0, -1, 1.5, 2147483648])('rejects invalid numeric round: %s', pastExamRound => {
    expect(validateQuestions(parse({ questionType: '기출문제', pastExamRound, questionOrder: 1 }), [])[0].messages.join(' ')).toContain('pastExamRound');
});

test('JSON round must be a number; mock tags and round null remain unchanged', () => {
    expect(() => parse({ questionType: '기출문제', pastExamRound: '39', questionOrder: 1 })).toThrow('pastExamRound는 숫자');
    expect(buildQuestionsRequest(parse({ tags: '35,36,37' })).questions[0]).toMatchObject({ tags: '35,36,37', pastExamRound: null, questionOrder: null });
    const both = parse({ questionType: '기출문제', pastExamRound: 39, pastExamId: 123, questionOrder: 1 });
    expect(both[0].pastExamRound).toBe(39);
});


test('image binding uses the actual filename after normalizing Unicode and surrounding JSON whitespace', () => {
    const filename = '문제.png'.normalize('NFD');
    const images = [{ file: new File(['png'], filename, { type: 'image/png' }), previewUrl: 'blob:q' }];
    const drafts = connectQuestionImages(parse({ imageFileName: ' 문제.png ', detailedExplanation: { imageFileName: '문제.png' } }), images);
    expect(validateQuestions(drafts, images)).toEqual([]);
    expect(buildQuestionsRequest(drafts).questions[0]).toMatchObject({ imageFileName: filename, detailedExplanation: { content: null, imageFileName: filename } });
});

test('equivalent Korean filenames are rejected as duplicates without guessing different filenames', () => {
    const composed = new File(['png'], '문제.png', { type: 'image/png' });
    const decomposed = new File(['png'], '문제.png'.normalize('NFD'), { type: 'image/png' });
    expect(validateImageFiles([composed, decomposed], [])).toContain('중복');
    const images = [{ file: composed, previewUrl: 'blob:q' }];
    expect(findSelectedImage('다른문제.png', images)).toBeUndefined();
    const drafts = connectQuestionImages(parse({ imageFileName: '다른문제.png' }), images);
    expect(validateQuestions(drafts, images)[0].messages.join(' ')).toContain('다른문제.png');
});
