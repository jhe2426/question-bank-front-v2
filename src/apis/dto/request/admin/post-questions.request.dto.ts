// interface: 관리자 문제 일괄 등록 JSON DTO (AdminQuestionDto) //
export interface AdminQuestionDto {
    sectionId: number;
    questionType: '모의고사' | '기출문제';
    difficulty: string | null;
    questionText: string;
    imageFileName: string | null;
    option1: string;
    option2: string;
    option3: string;
    option4: string;
    answer: number;
    shortExplanation: string | null;
    detailedExplanation: { content: string | null; imageFileName: string | null } | null;
    tags: string | null;
    pastExamId: number | null;
    questionOrder: number | null;
}

export default interface PostQuestionsRequestDto {
    questions: AdminQuestionDto[];
}
