import { Question } from 'src/types/interfaces';

export const QUESTIONS_PER_PAGE = 3;

export const sortPastExamQuestions = (questions: Question[]): Question[] =>
    [...questions].sort((a, b) => a.questionOrder - b.questionOrder);

export const getQuestionPageIndex = (questions: Question[], questionId: number): number | null => {
    const questionIndex = questions.findIndex(question => question.questionId === questionId);
    return questionIndex < 0 ? null : Math.floor(questionIndex / QUESTIONS_PER_PAGE);
};

