// 서버 AdminQuestionListItemDto / GetAdminQuestionListResponseDto에 대응합니다.
export type QuestionListFilter = { questionType: '기출문제'; pastExamRound: number } | { questionType: '모의고사'; difficulty: '상' | '중' | '하' };
export interface AdminQuestionListItem {
    questionId: number;
    questionType: string;
    questionText: string;
    difficulty: string | null;
    imageUrl: string | null;
    sectionId: number;
    pastExamRound: number | null;
    questionOrder: number | null;
}
export interface AdminQuestionPage {
    questions: AdminQuestionListItem[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
    last: boolean;
}

// function: 서버 응답 검증 — DTO가 바뀌면 이 경계에서 변경합니다. 미확인 응답을 빈 목록으로 처리하지 않습니다. //
export function parseAdminQuestionPage(data: unknown): AdminQuestionPage {
    const value = data as Record<string, unknown> | null;
    const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
    const nullableInteger = (v: unknown) => v === null || integer(v);
    const nullableString = (v: unknown) => v === null || typeof v === 'string';
    if (!value || value.code !== 'SU' || !Array.isArray(value.questions)
        || !integer(value.totalElements) || !integer(value.totalPages) || !integer(value.page)
        || !integer(value.size) || value.size < 1 || typeof value.last !== 'boolean'
        || !value.questions.every(q => q && integer(q.questionId) && typeof q.questionType === 'string'
            && typeof q.questionText === 'string' && nullableString(q.difficulty) && nullableString(q.imageUrl)
            && integer(q.sectionId) && nullableInteger(q.pastExamRound) && nullableInteger(q.questionOrder))) {
        throw new Error(typeof value?.message === 'string' && value.code !== 'SU'
            ? value.message : '문제 목록 응답 형식을 확인할 수 없습니다. 서버 응답 규격을 확인해주세요.');
    }
    return value as unknown as AdminQuestionPage;
}
