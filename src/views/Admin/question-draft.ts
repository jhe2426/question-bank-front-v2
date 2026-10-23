import { PostQuestionsRequestDto } from 'src/apis/dto/request/admin';

// interface: 숫자도 문자열로 보관하여 빈 입력과 잘못된 입력을 수정할 수 있는 편집 상태 //
export interface QuestionDraft {
    key: string;
    sectionId: string;
    questionType: string;
    difficulty: string;
    questionText: string;
    imageFileName: string;
    option1: string;
    option2: string;
    option3: string;
    option4: string;
    answer: string;
    shortExplanation: string;
    detailedExplanation: { content: string; imageFileName: string } | null;
    tags: string;
    pastExamId: string;
    questionOrder: string;
}

export interface SelectedImage { file: File; previewUrl: string }
export interface QuestionIssue { key: string; number: number; messages: string[] }
export const OPTION_FIELDS = ['option1', 'option2', 'option3', 'option4'] as const;
export const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
let draftSequence = 0;

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const positiveInteger = (value: string) => /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 2147483647;
const nullableText = (value: string) => value.trim() ? value : null;

// function: 서버의 questions 배열만 읽으며 의미 검증은 편집 후 등록 시 수행 //
export const parseQuestionFile = (text: string): QuestionDraft[] => {
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch { throw new Error('JSON 문법이 올바르지 않습니다. 괄호와 쉼표를 확인해주세요.'); }
    if (!isObject(parsed) || !Array.isArray(parsed.questions) || !parsed.questions.length) {
        throw new Error('비어 있지 않은 questions 배열이 필요합니다.');
    }
    return parsed.questions.map((item: unknown, index: number) => {
        if (!isObject(item)) throw new Error(`${index + 1}번 문제는 JSON 객체여야 합니다.`);
        const read = (field: string, numeric = false) => {
            const value = item[field];
            if (value == null) return '';
            if (typeof value === 'string' || (numeric && typeof value === 'number')) return String(value);
            throw new Error(`${index + 1}번 문제의 ${field} 형식이 올바르지 않습니다.`);
        };
        const detail = item.detailedExplanation;
        if (detail != null && !isObject(detail)) throw new Error(`${index + 1}번 문제의 detailedExplanation은 객체 또는 null이어야 합니다.`);
        const readDetail = (field: string) => {
            const value = isObject(detail) ? detail[field] : null;
            if (value == null) return '';
            if (typeof value !== 'string') throw new Error(`${index + 1}번 문제의 상세 해설 ${field}는 문자열이어야 합니다.`);
            return value;
        };
        return {
            key: `question-draft-${++draftSequence}`, sectionId: read('sectionId', true),
            questionType: read('questionType'), difficulty: read('difficulty'), questionText: read('questionText'),
            imageFileName: read('imageFileName'), option1: read('option1'), option2: read('option2'),
            option3: read('option3'), option4: read('option4'), answer: read('answer', true),
            shortExplanation: read('shortExplanation'), tags: read('tags'),
            pastExamId: read('pastExamId', true), questionOrder: read('questionOrder', true),
            detailedExplanation: detail == null ? null : { content: readDetail('content'), imageFileName: readDetail('imageFileName') }
        };
    });
};

// function: 문제 번호별 필수값, DTO 길이, 태그 및 이미지 참조 검증 //
export const validateQuestions = (questions: QuestionDraft[], images: SelectedImage[]): QuestionIssue[] => {
    const filenames = new Set(images.map(image => image.file.name));
    return questions.flatMap((question, index) => {
        const messages: string[] = [];
        if (!['모의고사', '기출문제'].includes(question.questionType)) messages.push('문제 유형을 모의고사 또는 기출문제로 선택해주세요.');
        if (!positiveInteger(question.sectionId)) messages.push('섹션 ID를 1 이상의 정수로 입력해주세요.');
        const textFields = [['questionText', '문제 지문'], ...OPTION_FIELDS.map((field, i) => [field, `선택지 ${i + 1}`])] as [keyof QuestionDraft, string][];
        textFields.forEach(([field, label]) => {
            const value = question[field] as string;
            if (!value.trim()) messages.push(`${label}을(를) 입력해주세요.`);
            else if (value.length > 255) messages.push(`${label}은(는) 255자 이하여야 합니다.`);
        });
        if (!/^[1-4]$/.test(question.answer)) messages.push('정답 번호는 1~4 중 선택해주세요.');
        const validateImage = (filename: string, label: string) => {
            if (filename.trim() && !filenames.has(filename)) messages.push(`${label} 파일이 없습니다: ${filename}`);
        };
        validateImage(question.imageFileName, '문제 이미지');
        if (question.detailedExplanation) {
            const detail = question.detailedExplanation;
            if (!detail.content.trim() && !detail.imageFileName.trim()) messages.push('상세 해설에 내용 또는 이미지를 추가하거나 상세 해설 사용을 해제해주세요.');
            validateImage(detail.imageFileName, '상세 해설 이미지');
        }
        if (question.questionType === '기출문제') {
            if (!positiveInteger(question.pastExamId)) messages.push('기출 회차 ID를 1 이상의 정수로 입력해주세요.');
            if (!positiveInteger(question.questionOrder)) messages.push('기출문제 순서를 1 이상의 정수로 입력해주세요.');
            if (question.tags.trim()) messages.push('기출문제에는 모의고사 태그를 사용할 수 없습니다. 태그를 지워주세요.');
        } else if (question.questionType === '모의고사' && question.tags.trim()) {
            const tags = question.tags.split(',').map(tag => tag.trim());
            if (tags.some(tag => !positiveInteger(tag))) messages.push('모의고사 태그는 35,36,37처럼 쉼표로 구분한 양의 정수여야 합니다.');
            else if (new Set(tags.map(Number)).size !== tags.length) messages.push('모의고사 태그에 같은 회차가 중복되어 있습니다.');
        }
        return messages.length ? [{ key: question.key, number: index + 1, messages }] : [];
    });
};

// function: 원본 File 대신 최신 편집 상태를 정확한 백엔드 DTO로 직렬화 //
export const buildQuestionsRequest = (questions: QuestionDraft[]): PostQuestionsRequestDto => ({
    questions: questions.map(question => ({
        sectionId: Number(question.sectionId), questionType: question.questionType as '모의고사' | '기출문제',
        difficulty: nullableText(question.difficulty), questionText: question.questionText,
        imageFileName: nullableText(question.imageFileName), option1: question.option1, option2: question.option2,
        option3: question.option3, option4: question.option4, answer: Number(question.answer),
        shortExplanation: nullableText(question.shortExplanation),
        detailedExplanation: question.detailedExplanation ? {
            content: nullableText(question.detailedExplanation.content),
            imageFileName: nullableText(question.detailedExplanation.imageFileName)
        } : null,
        tags: question.questionType === '모의고사' ? nullableText(question.tags) : null,
        pastExamId: question.questionType === '기출문제' ? Number(question.pastExamId) : null,
        questionOrder: question.questionType === '기출문제' ? Number(question.questionOrder) : null
    }))
});

export const validateImageFiles = (files: File[], existing: SelectedImage[]): string | null => {
    const names = new Set(existing.map(image => image.file.name));
    for (const file of files) {
        if (!/\.(png|jpe?g|webp)$/i.test(file.name) || (file.type && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) return `${file.name}: PNG, JPG, JPEG, WEBP 이미지를 선택해주세요.`;
        if (!file.size || file.size > 10 * 1024 * 1024) return `${file.name}: 비어 있지 않은 10MB 이하 이미지를 선택해주세요.`;
        if (names.has(file.name)) return `중복된 이미지 파일명입니다: ${file.name}`;
        names.add(file.name);
    }
    return null;
};
