import { UserAnswer } from 'src/types/interfaces';

// interface: post killer exam grading request body DTO //
export default interface PostKillerExamGradingRequestDto {
    sessionId: number;
    timeSpentSeconds: number;
    userAnswers: UserAnswer[];
}