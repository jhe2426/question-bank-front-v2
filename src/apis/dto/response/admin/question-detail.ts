// Spring GetAdminQuestionDetailResponseDto / PutAdminQuestionRequestDto.
export interface AdminQuestionDetail {
    questionId: number;
    questionType: '기출문제' | '모의고사';
    sectionId: number;
    // 기존 기출 데이터에는 난이도가 null이거나 현재 선택지 외 문자열일 수 있습니다.
    difficulty: string | null;
    questionText: string;
    imageUrl: string | null;
    option1: string;
    option2: string;
    option3: string;
    option4: string;
    answer: number;
    shortExplanation: string | null;
    detailedExplanation: { content: string | null; imageUrl: string | null } | null;
    pastExamRound: number | null;
    questionOrder: number | null;
    tags: number[];
}
export interface PutAdminQuestionRequestDto {
    questionText: string;
    option1: string;
    option2: string;
    option3: string;
    option4: string;
    answer: number;
    difficulty: '상' | '중' | '하' | null;
    sectionId: number;
    shortExplanation: string | null;
    detailedExplanation: { content: string | null } | null;
    deleteQuestionImage: boolean;
    deleteExplanationImage: boolean;
    pastExamRound: number | null;
    questionOrder: number | null;
    tags: number[];
}

export function parseAdminQuestionDetail(data: unknown): AdminQuestionDetail {
    const value = data as Record<string, any> | null;
    const positive = (v: unknown) => Number.isInteger(v) && (v as number) > 0;
    const nullablePositive = (v: unknown) => v === null || positive(v);
    const nullableString = (v: unknown) => v === null || typeof v === 'string';
    if (!value || value.code !== 'SU' || !positive(value.questionId)
        || !['기출문제', '모의고사'].includes(value.questionType)
        || !positive(value.sectionId) || !nullableString(value.difficulty)
        || !['questionText', 'option1', 'option2', 'option3', 'option4'].every(key => typeof value[key] === 'string')
        || !nullableString(value.imageUrl) || !nullableString(value.shortExplanation)
        || !Number.isInteger(value.answer) || value.answer < 1 || value.answer > 4
        || !nullablePositive(value.pastExamRound) || !nullablePositive(value.questionOrder)
        || !Array.isArray(value.tags) || !value.tags.every(positive)
        || (value.detailedExplanation !== null && (!value.detailedExplanation
            || !nullableString(value.detailedExplanation.content) || !nullableString(value.detailedExplanation.imageUrl)))) {
        throw new Error(typeof value?.message === 'string' && value.code !== 'SU'
            ? value.message : '문제 상세 응답 형식을 확인할 수 없습니다.');
    }
    return value as AdminQuestionDetail;
}
