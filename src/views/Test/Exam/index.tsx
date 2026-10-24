import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './style.css';
import 'katex/dist/katex.min.css';
import './responsive.css';
import { TestIcon, TestPagination, TestFooter, renderContentWithMath } from '../components/TestUi';
import { usePagination } from 'src/hooks';
import { Question, UserAnswer } from 'src/types/interfaces';
import { useLocation, useNavigate, useParams } from 'react-router';
import { GetPastExamQuestionListResponseDto } from 'src/apis/dto/response/pastExam';
import { PostExamResponseDto, ResponseDto } from 'src/apis/dto/response';
import { GRADING_VIEW_ABSOLUTE_PATH, MAIN_ABSOLUTE_PATH, MESSAGE, RESPONSE_CODE } from 'src/constants';
import { useAuthStore } from 'src/stores';
import { ExamInfo } from 'src/types/aliases';
import { getIncorrectQuestionListRequest, getKillerExamQuestionListRequest, getMockExamQuestionListRequest, getPastExamQuestionListRequest, postIncorrectQuestionGradingReuqest, postKillerExamGradingRequest, postMockExamGradingRequest, postPastExamGradingRequest } from 'src/apis';
import { GetKillerExamQuestionListResponseDto } from 'src/apis/dto/response/killerExam';
import { GetMockExamQuestionListResponseDto } from 'src/apis/dto/response/mockExam';
import { GetIncorrectQuestionListResponseDto } from 'src/apis/dto/response/incorrectQuestions';
import { PostKillerExamGradingRequestDto } from 'src/apis/dto/request/killerExam';
import { PostPastExamGradingRequestDto } from 'src/apis/dto/request/pastExam';
import { PostMockExamGradingRequestDto } from 'src/apis/dto/request/mockExam';
import { PostIncorrectQuestionGradingRequestDto } from 'src/apis/dto/request/incorrectQuestions';

// interface: 시험 문제 레코드 컴포넌트 속성 //
interface QuestionTableItemProps {
    question: Question;
    selectedAnswer?: { answer: number; questionOrder: number };
    showExplanation: boolean;
    disabled: boolean;
    onClick: (questionId: number, answer: number, questionOrder: number) => void;
}

// component: 시험 문제 레코드 컴포넌트 //
const QuestionTableItem = memo(({ question, selectedAnswer, showExplanation, disabled, onClick }: QuestionTableItemProps) => {

    const { questionId, questionOrder, questionText, imageUrl, option1, option2, option3, option4, shortExplanation } = question;

    // variable: 보기 목록과 이미지 유무에 따른 배치 클래스 //
    const options = [option1, option2, option3, option4];
    const optionListClass = `exam-option-list${imageUrl ? ' has-image' : ''}`;

    // render: 번호, 지문, 이미지, 객관식 보기 및 해설 렌더링 //
    return (
        <article className='exam-question' id={`exam-question-${questionOrder}`} aria-labelledby={`exam-question-title-${questionId}`} tabIndex={-1}>
            <span className='exam-question-number' aria-hidden='true'>{String(questionOrder).padStart(2, '0')}</span>
            <div className='exam-question-content'>
                <div className='exam-question-heading'>
                    <h2 id={`exam-question-title-${questionId}`}><span className='exam-sr-only'>{questionOrder}번 문제. </span>{renderContentWithMath(questionText)}</h2>
                </div>
                {imageUrl && (
                    <div className='exam-question-image'>
                        <img src={imageUrl} alt={`${questionOrder}번 문제의 지문 또는 도표`} />
                    </div>
                )}
                <fieldset className={optionListClass} disabled={disabled}>
                    <legend className='exam-sr-only'>{questionOrder}번 문제의 답안 선택</legend>
                    {options.map((option, index) => {
                        const number = index + 1;
                        const isSelected = selectedAnswer?.answer === number;
                        return (
                            <label key={number} className={`exam-option${isSelected ? ' is-selected' : ''}`}>
                                <input type='radio' className='exam-radio-input' name={`question-${questionId}`} value={number} checked={isSelected} onChange={() => onClick(questionId, number, questionOrder)} />
                                <span className='exam-option-number'>{number}</span>
                                <span className='exam-option-text'>{renderContentWithMath(option)}</span>
                            </label>
                        );
                    })}
                </fieldset>
                {showExplanation && shortExplanation && (
                    <div className='exam-explanation'>
                        <h3><TestIcon name='explanation' />해설</h3>
                        <div>{renderContentWithMath(shortExplanation)}</div>
                    </div>
                )}
            </div>
        </article>
    );
});

// interface: 답안 표기란 레코드 컴포넌트 속성 //
interface AnswerTableItemProps {
    question: Question;
    selectedAnswer?: { answer: number; questionOrder: number };
    onClick: (questionId: number, questionOrder: number, answer: number) => void;
    onQuestionClick: (questionOrder: number) => void;
    isCurrentPage: boolean;
    disabled: boolean;
}

// component: 문제 영역과 같은 답안 상태를 사용하는 답안 표기란 레코드 //
const AnswerTableItem = memo(({ question, selectedAnswer, onClick, onQuestionClick, isCurrentPage, disabled }: AnswerTableItemProps) => {
    const { questionId, questionOrder } = question;

    // render: 문항 이동 버튼 및 보기별 선택 상태 렌더링 //
    return (
        <div className={`exam-answer-row${isCurrentPage ? ' is-current' : ''}`}>
            <button type='button' className='exam-answer-number' aria-label={`${questionOrder}번 문제로 이동`} aria-current={isCurrentPage ? 'true' : undefined} onClick={() => onQuestionClick(questionOrder)}>{questionOrder}</button>
            <fieldset className='exam-answer-options' disabled={disabled}>
                <legend className='exam-sr-only'>{questionOrder}번 문제 답안 표기</legend>
                {[1, 2, 3, 4].map(number => (
                    <label className={`exam-answer-option${selectedAnswer?.answer === number ? ' is-selected' : ''}`} key={number}>
                        <input type='radio' className='exam-radio-input' name={`answer-sheet-${questionId}`} value={number} checked={selectedAnswer?.answer === number} aria-label={`${questionOrder}번 문제 ${number}번 보기`} onChange={() => onClick(questionId, questionOrder, number)} />
                        <span>{number}</span>
                    </label>
                ))}
            </fieldset>
        </div>
    );
});

// component: 시험 화면 컴포넌트 //
export default function Exam() {

    // variable: localStorage에 저장할 시험 데이터 키 //
    const EXAM_STORAGE_KEY = 'examData';
    // variable: localStorage 유효 시간(1시간) //
    const EXAM_STORAGE_EXPIRE_TIME = 1000 * 60 * 60;

    // variable: 페이지당 문제 수 //
    const QUESTION_COUNT_PER_PAGE = 3;

    // state: accessToken 정보 상태 //
    const { accessToken } = useAuthStore();

    // state: 페이지네이션 상태 //
    const {
        currentPage, setCurrentPage, totalPage,
        setTotalList, viewList
    } = usePagination<Question>(QUESTION_COUNT_PER_PAGE);

    // state: 경로 상태 //
    const { pathname } = useLocation();

    // state: 경로 파라미터 조회 //
    const params = useParams();

    // state: 시험 문제 리스트 //
    const [questionList, setQuestionList] = useState<Question[]>([]);

    // state: 현재 풀이 회차를 식별하는 값 (모의고사/킬러문제 완료 여부 판단 기준) //
    const [sessionId, setSessionId] = useState<number>();

    // state: 선택된 문제 정답 번호 리스트 //
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, {answer: number, questionOrder: number}>>({});

    // state: 타이머 상태 //
    const [time, setTime] = useState(90 * 60);
    
    // state: 문제 목록 로딩, 오류 및 재조회 상태 //
    const [isQuestionLoading, setIsQuestionLoading] = useState<boolean>(true);
    const [questionError, setQuestionError] = useState<string>('');
    const [loadAttempt, setLoadAttempt] = useState<number>(0);
    // state: 답안 제출 진행 상태 //
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    // state: 답안 표기란에서 이동할 문항 번호 //
    const [targetQuestionOrder, setTargetQuestionOrder] = useState<number | null>(null);


    // reference: 중복 제출 방지 및 타이머에서 사용할 최신 제출 함수 //
    const isSubmittingRef = useRef<boolean>(false);
    const submitPastExamRef = useRef<() => void>(() => {});

    // reference: 시험 시작 시간 // 
    const examStartTimeRef = useRef<{
        examKey: string;
        startedAt: number;
    } | null>(null);

    // variable: RESPONSE CODE 구조 분해 상수 //
    const { DATABASE_ERROR, AUTHENTICATION_FAILED, PAST_EXAM_QUESTION_NOT_FOUND, NOT_EXIST_QUESTION_ID, SUCCESS} = RESPONSE_CODE;

    // variable: 시험 유형 판별 //
    const isMockExam = pathname.includes('mock-exam');
    const isPastExam = pathname.includes('past-exam');
    const isKillerExam = pathname.includes('killer-exam');
    const isIncorrectExam = pathname.includes('incorrect-questions');

    // variable: 기출문제 타이머의 시·분·초 표시 문자열 //
    const remainingTimeText = [Math.floor(time / 3600), Math.floor(time % 3600 / 60), time % 60]
        .map(value => String(value).padStart(2, '0')).join(':');

    // function: 네비게이터 함수 //
    const navigator = useNavigate();

    // function: 전달된 파라미터를 기반으로 제목 생성하는 함수 //
    const initExamInfo = (): ExamInfo | null => {

        if (isMockExam && params?.unitId && params?.chapterId && params?.difficulty) {
            const { unitId, chapterId, difficulty, hasExplanation } = params;

            const explanation = hasExplanation === 'true';
            let mappedDifficulty = '';

            if (difficulty === '상') mappedDifficulty = 'HIGH';
            else if (difficulty === '중') mappedDifficulty = 'MEDIUM';
            else if (difficulty === '하') mappedDifficulty = 'LOW';

            return {
                type: 'mock',
                title: `모의고사 ${unitId}단원 - ${difficulty}`,
                unitId: Number(unitId),
                chapterId: Number(chapterId),
                difficulty: mappedDifficulty,
                hasExplanation: explanation
            };
        } 
        
        if (isPastExam && params?.pastExamId && params?.pastExamRound) {
            const { pastExamId, pastExamRound } = params;

            return {
                type: 'past',
                title: `${pastExamRound}회 기출문제`,
                pastExamId: Number(pastExamId),
                pastExamRound: Number(pastExamRound)
            };
        } 
        
        if (isKillerExam) {
            return {
                type: 'killer',
                title: '킬러문제'
            };
        } 
        
        if (isIncorrectExam && params?.sourceType) {
            const { sourceType } = params;

            return {
                type: 'incorrect',
                title: `${sourceType} 오답`,
                sourceType 
            };
        }    

        return null;
    };

    // variable: URL 파라미터 기반으로 계산된 시험 정보 //
    const examInfo = useMemo(() => initExamInfo(), [
        isMockExam,
        isPastExam,
        isKillerExam,
        isIncorrectExam,
        params
    ]);

    // variable: API에 전달하는 시험명과 분리한 화면 표시 정보 //
    const displayExamTitle = examInfo?.title.replace(' - ', ' · ') ?? '시험 문제';
    const examTypeLabel = isMockExam ? '모의고사' : isPastExam ? '기출문제' : isKillerExam ? '킬러문제' : '오답문제';
    const hasExplanation = examInfo?.type !== 'mock' || examInfo.hasExplanation;

    // variable: 실제 문제 목록과 선택 답안으로 계산하는 진행 현황 //
    const totalQuestionCount = questionList.length;
    const answeredQuestionCount = questionList.filter(question => {
        const answer = selectedAnswers[question.questionId]?.answer;
        return answer !== undefined && answer >= 1 && answer <= 4;
    }).length;
    const remainingQuestionCount = totalQuestionCount - answeredQuestionCount;
    const progressPercent = totalQuestionCount ? Math.round(answeredQuestionCount / totalQuestionCount * 100) : 0;
    const isExamReady = !isQuestionLoading && !questionError && totalQuestionCount > 0;
    const canSubmit = isExamReady && !isSubmitting && (!(isMockExam || isKillerExam) || sessionId !== undefined);

    // function: 시험 상태 저장 //
    const saveExamToStorage = (
        questionList: Question[],
        selectedAnswers: Record<number, { answer: number; questionOrder: number }>,
        sessionId: number | null,
        examInfo?: ExamInfo | null
    ) => {
        const data = {
            type: examInfo?.type,
            saveAt: Date.now(),
            questionList,
            selectedAnswers,
            sessionId,
            examInfo
        };
        
        localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(data));
    };

    // function: 시험 상태 불러오기 //
    const loadExamFromStorage = () => {
        const rawData = localStorage.getItem(EXAM_STORAGE_KEY);
        if (!rawData) return null;

        const data = JSON.parse(rawData);

        const isExpired = Date.now () - data.saveAt > EXAM_STORAGE_EXPIRE_TIME;
        if (isExpired) {
            clearExamStorage();
            return null;
        }

        return data;
    };

    // function: 시험 상태 삭제 //
    const clearExamStorage = () => {
        localStorage.removeItem(EXAM_STORAGE_KEY);
    };

    // function: 문제 리스트 기반 초기 답안 상태 생성 //
    const createInitialAnswers = (questions: Question[]): Record<number, {answer: number; questionOrder: number}> => {
        return questions.reduce((acc, q) => {
            acc[q.questionId] = {
                answer: 0,
                questionOrder: q.questionOrder
            }; 
        return acc;
        }, {} as Record<number, { answer: number; questionOrder: number }>);
    };

    // function: 시험 전체 소요 시간 계산 (초) //
    const getTimeSpentSeconds = (): number => {
        const startTime = examStartTimeRef.current?.startedAt;

        if (startTime === undefined) return 0;

        return Math.max(
            0,
            Math.floor((Date.now() - startTime) / 1000)
        );
    };

    // function: get past exam question list response 처리 함수 //
    const getPastExamQuestionListResponse = (responseBody: GetPastExamQuestionListResponseDto | ResponseDto | null) => {
        setIsQuestionLoading(false);
        const message =
            !responseBody ? MESSAGE.SERVER_ERROR :
            responseBody.code === DATABASE_ERROR ?  MESSAGE.SERVER_ERROR :
            responseBody.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED : 
            responseBody.code === PAST_EXAM_QUESTION_NOT_FOUND ? '기출문제를 찾을 수 없습니다' : '';

        const isSuccess = responseBody !== null && responseBody.code === SUCCESS;
        if (!isSuccess) {
            setQuestionError(message || MESSAGE.SERVER_ERROR);
            alert(message);
            return;
        }

        const { questions } = responseBody as GetPastExamQuestionListResponseDto;
        setQuestionList(questions);
        setTotalList(questions);
        setSelectedAnswers(createInitialAnswers(questions));
    };

    // function: get killer exam question list response 처리 함수 //
    const getKillerExamQuestionListResponse = (responseBody: GetKillerExamQuestionListResponseDto | ResponseDto | null) => {
        setIsQuestionLoading(false);
        const message =
            !responseBody ? MESSAGE.SERVER_ERROR :
            responseBody.code === DATABASE_ERROR ?  MESSAGE.SERVER_ERROR :
            responseBody.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED : '';

        const isSuccess = responseBody !== null && responseBody.code === SUCCESS;
        if (!isSuccess) {
            setQuestionError(message || MESSAGE.SERVER_ERROR);
            alert(message);
            return;
        }

        const { sessionId, questions } = responseBody as GetKillerExamQuestionListResponseDto;
        setQuestionList(questions);
        setTotalList(questions);
        setSessionId(sessionId);
        const initialAnswer = createInitialAnswers(questions);
        setSelectedAnswers(initialAnswer);
        saveExamToStorage(questions, initialAnswer, sessionId, examInfo);
    };

    // function: get mock exam question list response 처리 함수 //
    const getMockExamQuestionListResponse = (responseBody: GetMockExamQuestionListResponseDto | ResponseDto | null) => {
        setIsQuestionLoading(false);
        const message =
            !responseBody ? MESSAGE.SERVER_ERROR :
            responseBody.code === DATABASE_ERROR ?  MESSAGE.SERVER_ERROR :
            responseBody.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED : '';

        const isSuccess = responseBody !== null && responseBody.code === SUCCESS;
        if (!isSuccess) {
            setQuestionError(message || MESSAGE.SERVER_ERROR);
            alert(message);
            return;
        }

        const { sessionId, questions } = responseBody as GetMockExamQuestionListResponseDto;
        if (questions.length === 0) {
            navigator(MAIN_ABSOLUTE_PATH);
            setTimeout(() => {
                alert('해당 조건의 모의고사 문제는 모두 풀었습니다.');
            }, 50);
            return;
        }

        setQuestionList(questions);
        setTotalList(questions);
        setSessionId(sessionId);
        const initialAnswer = createInitialAnswers(questions);
        setSelectedAnswers(initialAnswer);
        saveExamToStorage(questions, initialAnswer, sessionId, examInfo);
    };

    // function: get incorrect question list response 처리 함수 //
    const getIncorrectQuestionListResponse = (responseBody: GetIncorrectQuestionListResponseDto | ResponseDto | null) => {
        setIsQuestionLoading(false);
        const message =
            !responseBody ? MESSAGE.SERVER_ERROR :
            responseBody.code === DATABASE_ERROR ?  MESSAGE.SERVER_ERROR :
            responseBody.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED : '';

        const isSuccess = responseBody !== null && responseBody.code === SUCCESS;
        if (!isSuccess) {
            setQuestionError(message || MESSAGE.SERVER_ERROR);
            alert(message);
            return;
        }

        const { questions } = responseBody as GetIncorrectQuestionListResponseDto;

        if (questions.length === 0 ) {
            navigator(MAIN_ABSOLUTE_PATH);
            setTimeout(() => {
                alert('오답문제가 존재하지 않습니다.');
            }, 50);
            return;
        }

        setQuestionList(questions);
        setTotalList(questions);
        const initialAnswer = createInitialAnswers(questions);
        setSelectedAnswers(initialAnswer);
        saveExamToStorage(questions, initialAnswer, null, examInfo);
    };

    // function: post exam grading response 처리 함수 //
    const postExamGradingResponse = (responseBody: PostExamResponseDto | ResponseDto | null) => {
        const message =
            !responseBody ? MESSAGE.SERVER_ERROR :
            responseBody.code === DATABASE_ERROR ?  MESSAGE.SERVER_ERROR :
            responseBody.code === NOT_EXIST_QUESTION_ID ? MESSAGE.SERVER_ERROR :
            responseBody.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED : '';

        const isSuccess = responseBody !== null && responseBody.code === SUCCESS;
        if (!isSuccess) {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            alert(message);
            return;
        }

        const { groupId } = responseBody as PostExamResponseDto;
        if (!isPastExam) clearExamStorage();

        navigator(GRADING_VIEW_ABSOLUTE_PATH(groupId, 'all'));
    };

    // event handler: 문제 영역 정답 변경 이벤트 처리 //
    const onQuestionAnswerClickHandler = useCallback((questionId: number, answer: number, questionOrder: number) => {
        setSelectedAnswers((prev) => ({
            ...prev,
            [questionId]: {answer, questionOrder},
        })); 
    }, []);

    // event handler: 답안 표기란 정답 변경 이벤트 처리 //
    const onAnswerSheetClickHandler = useCallback((questionId: number, questionOrder: number, answer: number) => {
        setSelectedAnswers((prev) => ({
            ...prev,
            [questionId]: {answer, questionOrder},
        }));    

        const targetPage = Math.ceil(questionOrder / QUESTION_COUNT_PER_PAGE);
        if (targetPage === currentPage) return;
        setCurrentPage(targetPage);

    }, [currentPage, setCurrentPage]);

    // event handler: 답안 표기란 문항 번호 클릭 시 해당 문제로 이동 //
    const onQuestionNavigateHandler = (questionOrder: number) => {
        setCurrentPage(Math.ceil(questionOrder / QUESTION_COUNT_PER_PAGE));
        setTargetQuestionOrder(questionOrder);
    };

    // event handler: 기존 페이지 크기를 유지하는 이전·다음 문제 이동 //
    const onPageChangeHandler = (nextPage: number) => {
        if (!isExamReady || nextPage < 1 || nextPage > totalPage) return;
        setCurrentPage(nextPage);
        window.scrollTo(0, 0);
    };

    // event handler: 기출문제 자동 제출 처리 //
    const submitPastExam = () => {
        if (!accessToken || !examInfo || examInfo.type !== 'past' || isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);

        const userAnswers: UserAnswer[] = Object.entries(selectedAnswers).map(
            ([questionId, value]) => ({
                questionId: Number(questionId),
                questionOrder: value.questionOrder,
                answer: value.answer
            })
        );


        const requestBody: PostPastExamGradingRequestDto = {
            detailedType: examInfo.title,
            pastExamId: Number(examInfo?.pastExamId),
            timeSpentSeconds: getTimeSpentSeconds(),
            userAnswers
        };


        postPastExamGradingRequest(requestBody, accessToken).then(postExamGradingResponse);
    };

    // event handler: 채점하기 버튼 클릭 이벤트 처리 //
    const onClickGradingButtonHandler = () => {

        if (!accessToken || !canSubmit || isSubmittingRef.current) return;

        const unansweredCount = remainingQuestionCount;

        if (unansweredCount > 0) {
            const isConfirm = window.confirm(`아직 풀지 않은 문제가 ${unansweredCount}개 있습니다. 그래도 채점하시겠습니까?`);

            if (!isConfirm) return;
        };

        if (!examInfo) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        const timeSpentSeconds = getTimeSpentSeconds();
        const sourceType = examInfo.type;  
        const userAnswers: UserAnswer[] = Object.entries(selectedAnswers).map(
            ([questionId, value]) => ({
                questionId: Number(questionId),
                questionOrder: value.questionOrder,
                answer: value.answer
            })

        );

        if (sourceType === 'killer' && sessionId) {
            const requestBody: PostKillerExamGradingRequestDto = {
                sessionId,
                timeSpentSeconds,
                userAnswers
            };

            postKillerExamGradingRequest(requestBody, accessToken).then(postExamGradingResponse);
            return;
        }
        
        if (sourceType === 'past' && examInfo.title) {
            const requestBody: PostPastExamGradingRequestDto = {
                detailedType: examInfo.title,
                pastExamId: Number(examInfo?.pastExamId),
                timeSpentSeconds,
                userAnswers
            };

            postPastExamGradingRequest(requestBody, accessToken).then(postExamGradingResponse);
            return;
        }

        if (sourceType === 'mock' && examInfo.title && sessionId) {
            const requestBody: PostMockExamGradingRequestDto = {
                detailedType: examInfo.title,
                sessionId,
                timeSpentSeconds,
                userAnswers
            };

            postMockExamGradingRequest(requestBody, accessToken).then(postExamGradingResponse);
            return;
        }

        if (sourceType === 'incorrect' && examInfo.title && examInfo.sourceType) {
            const requestBody: PostIncorrectQuestionGradingRequestDto = {
                sourceType: examInfo.sourceType,
                detailedType: examInfo.title,
                timeSpentSeconds,
                userAnswers
            };

            postIncorrectQuestionGradingReuqest(requestBody, accessToken).then(postExamGradingResponse);
            return;
        }
    };

    // effect: 시험 문제 로딩 완료 시 시간 측정 시작 //
    useEffect(() => {
        if (!isExamReady) return;
    
        const examKey = [
            pathname,
            sessionId ?? '',
            ...questionList.map(question => question.questionId)
        ].join('-');
    
        if (examStartTimeRef.current?.examKey === examKey) return;
    
        examStartTimeRef.current = {
            examKey,
            startedAt: Date.now()
        };
    
    }, [isExamReady, pathname, sessionId, questionList]);

    // effect: 선택한 문항이 렌더링되면 해당 문제로 스크롤 및 키보드 초점 이동 //
    useEffect(() => {
        if (targetQuestionOrder === null) return;
        const questionElement = document.getElementById(`exam-question-${targetQuestionOrder}`);
        if (!questionElement) return;
        questionElement.focus({ preventScroll: true });
        questionElement.scrollIntoView({ block: 'start' });
        setTargetQuestionOrder(null);
    }, [viewList, targetQuestionOrder]);

    // effect: pathname가 변경될 시 실행할 함수 //
    useEffect(() => {
        // 킬러문제는 진입할 때마다 서버에서 새로 출제하므로 저장 데이터를 읽지 않습니다.
        if (examInfo == null || isKillerExam) return;

        const savedData = loadExamFromStorage();
        if (!savedData) return;
        

        if (examInfo.type === 'incorrect' && savedData.examInfo.type === 'incorrect') {
            if (examInfo.sourceType !== savedData.examInfo.sourceType) {
                clearExamStorage();
                return;
            }
        }

        if (savedData.type !== examInfo.type) {
            clearExamStorage();
        }
    }, [pathname]);

    // effect: accessToken와 examInfo가 변경될 시 실행할 함수 //
    useEffect(() => {

        if (!accessToken || examInfo == null) return;

        setIsQuestionLoading(true);
        setQuestionError('');
        setCurrentPage(0);

        if (!isPastExam && !isKillerExam) {
            const savedData = loadExamFromStorage();

            if (savedData) {
                setQuestionList(savedData.questionList);
                setTotalList(savedData.questionList);
                setSelectedAnswers(savedData.selectedAnswers);
                setSessionId(savedData.sessionId);
                setIsQuestionLoading(false);
                return;
            }
        }

        if (isKillerExam && examInfo.type == 'killer') {
            getKillerExamQuestionListRequest(accessToken).then(getKillerExamQuestionListResponse);
            return;
        } 

        if (isMockExam && examInfo.type == 'mock') {
            getMockExamQuestionListRequest(accessToken, examInfo.chapterId, examInfo.difficulty, examInfo.hasExplanation).then(getMockExamQuestionListResponse);
            return;
        }

        if (isIncorrectExam && examInfo.type == 'incorrect') {
            getIncorrectQuestionListRequest(accessToken, examInfo.sourceType).then(getIncorrectQuestionListResponse);
            return;
        }
 
        if (!isPastExam) return;

        if (examInfo.type == 'past') {
            getPastExamQuestionListRequest(accessToken, examInfo.pastExamId).then(getPastExamQuestionListResponse);
        }

        const timer = setInterval(() => {
            setTime((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    submitPastExamRef.current();
                    alert('시험 시간이 종료되었습니다. 자동으로 제출됩니다.');
                    return 0;
                }
            return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [accessToken, examInfo, loadAttempt]);

    // render: 시험 응시 화면 컴포넌트 렌더링 //
    return (
        <main className='test-screen exam-screen'>
            {/* render: 시험명과 유형별 정보 카드 */}
            <div className='exam-heading-row'>
                <div className='exam-heading'>
                    <span className='exam-status'><span />시험 응시 중</span>
                    <h1>{displayExamTitle}</h1>
                    <p>실전처럼 풀고, 제출 후 결과를 확인하세요.</p>
                </div>
                <section className='exam-info-card' aria-label='시험 정보'>
                    <div className={`exam-info-item${isPastExam ? ' exam-timer' : ''}`}>
                        <span className='exam-info-icon'><TestIcon name={isPastExam ? 'clock' : 'document'} /></span>
                        <div>
                            <span className='exam-info-label'>{isPastExam ? '남은 시간' : '시험 유형'}</span>
                            {isPastExam
                                ? <time className={time <= 300 ? 'is-urgent' : ''} aria-label={`남은 시간 ${remainingTimeText}`}>{remainingTimeText}</time>
                                : <strong>{examTypeLabel}</strong>}
                        </div>
                    </div>
                    <div className='exam-info-item'>
                        <span className='exam-info-icon'><TestIcon name='document' /></span>
                        <div><span className='exam-info-label'>전체 문항</span><strong>{isQuestionLoading ? '불러오는 중' : `${totalQuestionCount}문항`}</strong></div>
                    </div>
                </section>
            </div>

            <div className='exam-workspace'>
                {/* render: 페이지당 3문항과 하단 이동·제출 버튼을 묶은 카드 */}
                <section className='exam-paper' aria-label='시험 문제' aria-busy={isQuestionLoading}>
                    <div className='exam-question-list'>
                        {isQuestionLoading ? (
                            <div className='exam-empty-state' role='status'><span className='exam-loading-dot' />문제를 불러오고 있습니다.</div>
                        ) : questionError ? (
                            <div className='exam-empty-state' role='alert'><p>{questionError}</p><button type='button' className='exam-action-button' onClick={() => setLoadAttempt(value => value + 1)}>다시 불러오기</button></div>
                        ) : !totalQuestionCount ? (
                            <div className='exam-empty-state'><p>현재 풀 수 있는 문제가 없습니다.</p><button type='button' className='exam-action-button' onClick={() => navigator(MAIN_ABSOLUTE_PATH)}>시험 유형 다시 선택</button></div>
                        ) : viewList.map(question => (
                            <QuestionTableItem key={question.questionId} question={question} selectedAnswer={selectedAnswers[question.questionId]} showExplanation={hasExplanation} disabled={isSubmitting} onClick={onQuestionAnswerClickHandler} />
                        ))}
                    </div>
                    <div className='exam-actions'>
                        <TestPagination currentPage={currentPage} totalPage={totalPage} disabled={!isExamReady} onPageChange={onPageChangeHandler} />
                        <button type='button' className='exam-action-button exam-submit-button' onClick={onClickGradingButtonHandler} disabled={!canSubmit}><TestIcon name='send' />{isSubmitting ? '제출 중…' : '답안 제출'}</button>
                    </div>
                </section>

                {/* render: 답안 표기란, 실제 응답 진행률 및 응시 안내 */}
                <aside className='exam-sidebar' aria-label='시험 진행 정보'>
                    <section className='exam-side-card exam-answer-sheet' aria-labelledby='exam-answer-title'>
                        <h2 id='exam-answer-title'><span className='exam-side-icon'><TestIcon name='target' /></span>답안 표기란</h2>
                        <div className='exam-answer-list'>
                            {isExamReady ? questionList.map(question => (
                                <AnswerTableItem key={question.questionId} question={question} selectedAnswer={selectedAnswers[question.questionId]} onClick={onAnswerSheetClickHandler} onQuestionClick={onQuestionNavigateHandler} isCurrentPage={viewList.some(item => item.questionId === question.questionId)} disabled={isSubmitting} />
                            )) : <p className='exam-side-placeholder'>{isQuestionLoading ? '문항을 불러오고 있습니다.' : '표시할 답안이 없습니다.'}</p>}
                        </div>
                        <p className='exam-answer-hint'>문항 번호를 누르면 해당 문제로 이동합니다.</p>
                    </section>
                    <section className='exam-side-card exam-progress' aria-labelledby='exam-progress-title'>
                        <div className='exam-side-heading'><h2 id='exam-progress-title'><span className='exam-side-icon'><TestIcon name='chart' /></span>진행 현황</h2><span><strong>{answeredQuestionCount}</strong> / {totalQuestionCount} 문항</span></div>
                        <div className='exam-progress-meter'><progress value={answeredQuestionCount} max={totalQuestionCount || 1} aria-label='답안 작성 진행률' /><span>{progressPercent}%</span></div>
                        <dl><div><dt>응답 완료</dt><dd>{answeredQuestionCount}문항</dd></div><div><dt>남은 문항</dt><dd>{remainingQuestionCount}문항</dd></div><div><dt>전체 문항</dt><dd>{totalQuestionCount}문항</dd></div></dl>
                    </section>
                    <section className='exam-guide' aria-labelledby='exam-guide-title'>
                        <h2 id='exam-guide-title'><span className='exam-side-icon'><TestIcon name='guide' /></span>응시 안내</h2>
                        <ul>
                            <li>답안은 제출 전까지 수정할 수 있습니다.</li>
                            <li>미응답 문항이 있으면 제출 전 확인합니다.</li>
                            {isPastExam && <li>제한 시간은 90분이며, 종료 시 자동 제출됩니다.</li>}
                            <li>제출 완료 후 결과를 확인할 수 있습니다.</li>
                        </ul>
                    </section>
                </aside>
            </div>

            {/* render: 메인페이지와 동일한 톤의 서비스 하단 안내 */}
            <TestFooter />
        </main>
    );
}
