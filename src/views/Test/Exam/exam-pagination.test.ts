import { Question } from 'src/types/interfaces';
import { getQuestionPageIndex, QUESTIONS_PER_PAGE, sortPastExamQuestions } from './exam-pagination';

const question = (questionId: number, questionOrder: number): Question => ({
    questionId,
    questionOrder,
    questionText: `${questionOrder}번 문제`,
    option1: '1',
    option2: '2',
    option3: '3',
    option4: '4'
});

describe('기출문제 페이지 계산', () => {
    test.each([
        [2, 1],
        [3, 1],
        [4, 2],
        [10, 4]
    ])('%i문제는 %i페이지로 계산한다', (questionCount, expectedPageCount) => {
        expect(Math.ceil(questionCount / QUESTIONS_PER_PAGE)).toBe(expectedPageCount);
    });

    test('관리자 지정 번호로 정렬하되 표시 번호를 배열 순번으로 바꾸지 않는다', () => {
        const original = [question(102, 38), question(101, 35)];

        const sorted = sortPastExamQuestions(original);

        expect(sorted.map(item => [item.questionId, item.questionOrder])).toEqual([[101, 35], [102, 38]]);
        expect(original.map(item => item.questionOrder)).toEqual([38, 35]);
    });

    test('문제 번호가 아닌 실제 배열 인덱스로 이동할 0 기반 페이지를 계산한다', () => {
        const questions = [question(1, 1), question(2, 5), question(3, 10), question(4, 35)];

        expect(getQuestionPageIndex(questions, 1)).toBe(0);
        expect(getQuestionPageIndex(questions, 2)).toBe(0);
        expect(getQuestionPageIndex(questions, 3)).toBe(0);
        expect(getQuestionPageIndex(questions, 4)).toBe(1);
        expect(getQuestionPageIndex(questions, 999)).toBeNull();
    });
});

