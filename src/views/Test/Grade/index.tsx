import React, { memo, useEffect, useState } from 'react';

import './style.css';
import 'katex/dist/katex.min.css';
import './responsive.css';
import { usePagination } from 'src/hooks';
import { ExamResult } from 'src/types/interfaces';
import { useNavigate, useParams } from 'react-router';
import { GRADING_VIEW_ABSOLUTE_PATH, MESSAGE, MY_PAGE_ABSOLUTE_PATH, RESPONSE_CODE } from 'src/constants';
import { useAuthStore } from 'src/stores';
import { GetExamResultListResponseDto } from 'src/apis/dto/response/examResult';
import { getExamResultListRequest } from 'src/apis';
import { TestIcon, TestPagination, TestFooter, renderContentWithMath } from '../components/TestUi';

// variable: 기존 시험 화면과 동일한 페이지당 문제 수 //
const QUESTION_COUNT_PER_PAGE = 3;

// function: 기존 정답 비교 기준을 유지하고 미응답을 별도로 구분 //
const getResultStatus = ({ answer, userAnswer }: ExamResult) => {
    if (![1, 2, 3, 4].includes(userAnswer)) return 'unanswered';
    return answer === userAnswer ? 'correct' : 'incorrect';
};

// variable: 채점 결과 상태별 안내 문구 //
const RESULT_LABELS = { correct: '정답', incorrect: '오답', unanswered: '미응답' };

// interface: 채점 문제 레코드 컴포넌트 속성 //
interface QuestionTableItemProps {
    examResult: ExamResult;
}

// component: 변경할 수 없는 답안과 실제 정답·상세 해설을 표시하는 문제 //
const QuestionTableItem = memo(({ examResult }: QuestionTableItemProps) => {
    const { questionId, questionOrder, questionText, imageUrl, option1, option2, option3, option4, answer, userAnswer, detailExplanationContent } = examResult;

    // variable: 실제 응답 데이터로 판정한 결과와 이미지별 보기 배치 //
    const status = getResultStatus(examResult);
    const options = [option1, option2, option3, option4];

    // render: 기존 이미지 에셋을 번호 위에 겹치고 미응답도 오답 사선으로 표시 //
    return (
        <article className='exam-question' id={`grade-question-${questionId}`} aria-labelledby={`grade-question-title-${questionId}`} tabIndex={-1}>
            <span className='exam-question-number' aria-hidden='true'>
                {String(questionOrder).padStart(2, '0')}
                <span className={`question-number-icon ${status === 'correct' ? 'correct' : 'incorrect'}`} />
            </span>
            <div className='exam-question-content'>
                <div className='exam-question-heading'>
                    <span className={`grade-result-tag is-${status}`}>{RESULT_LABELS[status]}</span>
                    <h2 id={`grade-question-title-${questionId}`}><span className='exam-sr-only'>{questionOrder}번 문제. </span>{renderContentWithMath(questionText)}</h2>
                </div>
                {imageUrl && <div className='exam-question-image'><img src={imageUrl} alt={`${questionOrder}번 문제의 지문 또는 도표`} /></div>}
                <div className={`exam-option-list${imageUrl ? ' has-image' : ''}`} role='list' aria-label={`${questionOrder}번 문제의 보기 및 채점 결과`}>
                    {options.map((option, index) => {
                        const number = index + 1;
                        const isAnswer = answer === number;
                        const isSelected = userAnswer === number;
                        const optionClass = isAnswer ? ' is-correct' : isSelected ? ' is-incorrect' : '';
                        return (
                            <div key={number} className={`exam-option${optionClass}`} role='listitem'>
                                <span className='exam-option-number'>{number}</span>
                                <span className='exam-option-text'>{renderContentWithMath(option)}</span>
                                {(isAnswer || isSelected) && <span className='grade-option-state'>{isAnswer ? (isSelected ? '정답 · 내 답안' : '정답') : '내 답안'}</span>}
                            </div>
                        );
                    })}
                </div>
                <section className='exam-explanation' aria-label={`${questionOrder}번 문제 해설`}>
                    <h3><TestIcon name='explanation' />해설<span className='grade-correct-answer'>정답 {answer}번</span></h3>
                    <div>{renderContentWithMath(detailExplanationContent) || '등록된 해설이 없습니다.'}</div>
                </section>
            </div>
        </article>
    );
});

// interface: 읽기 전용 답안 표기란 레코드 속성 //
interface AnswerTableItemProps {
    examResult: ExamResult;
    isCurrentPage: boolean;
    onQuestionClick: (questionId: number) => void;
}

// component: 시험 화면과 동일한 문항 번호 + 4개 원형 답안 구조 //
const AnswerTableItem = memo(({ examResult, isCurrentPage, onQuestionClick }: AnswerTableItemProps) => {
    const { questionId, questionOrder, userAnswer } = examResult;
    const status = getResultStatus(examResult);

    // render: 미응답 번호도 오답 사선으로 표시하고 선택한 답안만 강조 //
    return (
        <div className={`exam-answer-row is-${status}${isCurrentPage ? ' is-current' : ''}`}>
            <button type='button' className='exam-answer-number' onClick={() => onQuestionClick(questionId)} aria-label={`${questionOrder}번 문제, ${RESULT_LABELS[status]}, 문제로 이동`} aria-current={isCurrentPage ? 'true' : undefined}>
                {String(questionOrder).padStart(2, '0')}
                <span className={`answer-number-icon ${status === 'correct' ? 'correct' : 'incorrect'}`} aria-hidden='true' />
            </button>
            <div className='exam-answer-options' role='group' aria-label={`${questionOrder}번 문항 답안: ${status === 'unanswered' ? '미응답' : `${userAnswer}번 선택, ${RESULT_LABELS[status]}`}`}>
                {[1, 2, 3, 4].map(number => {
                    const isSelected = userAnswer === number;
                    const optionClass = isSelected ? ` is-${status} is-selected` : '';
                    return <span key={number} className={`exam-answer-option${optionClass}`} aria-label={`${number}번${isSelected ? `, 내 답안, ${RESULT_LABELS[status]}` : ''}`}><span>{number}</span></span>;
                })}
            </div>
        </div>
    );
});

// component: 시험 응시 화면의 공통 디자인을 사용하는 채점 결과 화면 //
export default function Grade() {
    // state: 인증 정보 및 기존 채점 결과 경로 변수 //
    const { accessToken } = useAuthStore();
    const { groupId, filter } = useParams();
    const navigator = useNavigate();

    // state: 기존 페이지네이션 훅을 이용한 3문항 단위 표시 //
    const { currentPage, setCurrentPage, totalPage, setTotalList, viewList } = usePagination<ExamResult>(QUESTION_COUNT_PER_PAGE);

    // state: API가 제공하는 시험 제목, 점수, 유형 및 문항별 결과 //
    const [title, setTitle] = useState('');
    const [totalScore, setTotalScore] = useState<number>();
    const [sourceType, setSourceType] = useState('');
    const [questionList, setQuestionList] = useState<ExamResult[]>([]);

    // state: 결과 조회 상태 및 답안 표기란에서 선택한 이동 대상 //
    const [isLoading, setIsLoading] = useState(true);
    const [resultError, setResultError] = useState('');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [targetQuestionId, setTargetQuestionId] = useState<number | null>(null);

    // variable: 기존 제목과 점수 공개 조건을 유지한 표시 정보 //
    const isAllResults = filter === 'all';
    const titleText = (sourceType === '킬러문제' ? sourceType : title || sourceType).replace(' - ', ' · ');
    const totalCount = questionList.length;
    const correctCount = questionList.filter(question => getResultStatus(question) === 'correct').length;
    const unansweredCount = questionList.filter(question => getResultStatus(question) === 'unanswered').length;
    const incorrectCount = totalCount - correctCount - unansweredCount;
    const accuracy = totalCount ? Math.round(correctCount / totalCount * 100) : 0;
    const isReady = !isLoading && !resultError && totalCount > 0;

    // event handler: 이전·다음 문제 페이지 이동 //
    const onPageChangeHandler = (page: number) => {
        if (!isReady || page < 1 || page > totalPage) return;
        setCurrentPage(page);
        document.querySelector('.grade-screen .exam-paper')?.scrollIntoView({ block: 'start' });
    };

    // event handler: 오답 필터의 비연속 문항 번호도 실제 목록 위치로 이동 //
    const onQuestionNavigateHandler = (questionId: number) => {
        const questionIndex = questionList.findIndex(question => question.questionId === questionId);
        if (questionIndex < 0) return;
        setCurrentPage(Math.floor(questionIndex / QUESTION_COUNT_PER_PAGE) + 1);
        setTargetQuestionId(questionId);
    };

    // effect: 이동 대상이 렌더링된 뒤 문제로 스크롤 및 키보드 초점 이동 //
    useEffect(() => {
        if (targetQuestionId === null) return;
        const questionElement = document.getElementById(`grade-question-${targetQuestionId}`);
        if (!questionElement) return;
        questionElement.focus({ preventScroll: true });
        questionElement.scrollIntoView({ block: 'start' });
        setTargetQuestionId(null);
    }, [viewList, targetQuestionId]);

    // effect: 기존 API와 응답 구조로 채점 결과를 조회하고 오류·빈 목록 처리 //
    useEffect(() => {
        if (accessToken == null || filter == null || groupId == null) return;
        let cancelled = false;
        setIsLoading(true);
        setResultError('');
        setQuestionList([]);
        setTitle('');
        setSourceType('');
        setTotalScore(undefined);
        setCurrentPage(0);
        setTargetQuestionId(null);

        getExamResultListRequest(accessToken, Number(groupId), filter).then(responseBody => {
            if (cancelled) return;
            setIsLoading(false);
            const { DATABASE_ERROR, AUTHENTICATION_FAILED, NO_PERMISSION, NOT_EXIST_GROUP_ID, SUCCESS } = RESPONSE_CODE;
            const message = !responseBody || responseBody.code === DATABASE_ERROR ? MESSAGE.SERVER_ERROR
                : responseBody.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED
                : responseBody.code === NO_PERMISSION ? MESSAGE.NO_PERMISSION
                : responseBody.code === NOT_EXIST_GROUP_ID ? '존재하지 않는 그룹 번호입니다' : MESSAGE.SERVER_ERROR;
            if (!responseBody || responseBody.code !== SUCCESS) {
                setResultError(message);
                alert(message);
                return;
            }
            const { sourceType, detailedType, totalScore, examResults } = responseBody as GetExamResultListResponseDto;
            setSourceType(sourceType);
            setTitle(detailedType);
            setTotalScore(totalScore);
            setQuestionList(examResults);
            setTotalList(examResults);
        });

        return () => { cancelled = true; };
    }, [accessToken, groupId, filter, loadAttempt, setCurrentPage, setTotalList]);

    // render: 시험 정보, 문제·해설, 답안 표기란, 실제 채점 결과 및 안내 //
    return (
        <main className='test-screen grade-screen'>
            <div className='exam-heading-row'>
                <div className='exam-heading'>
                    <span className='exam-status'><span />채점 결과</span>
                    <h1>{titleText || '채점 결과'}</h1>
                    <p>{isAllResults ? '채점이 완료되었습니다. 각 문항의 정답과 해설을 확인해 보세요.' : '복습 문항의 정답과 해설을 확인해 보세요.'}</p>
                </div>
                <section className='exam-info-card' aria-label='시험 정보'>
                    <div className='exam-info-item'><span className='exam-info-icon'><TestIcon name='document' /></span><div><span className='exam-info-label'>시험 유형</span><strong>{sourceType || '—'}</strong></div></div>
                    <div className='exam-info-item'><span className='exam-info-icon'><TestIcon name='document' /></span><div><span className='exam-info-label'>{isAllResults ? '전체 문항' : '복습 문항'}</span><strong>{isLoading ? '불러오는 중' : `${totalCount}문항`}</strong></div></div>
                </section>
            </div>
            <div className='exam-workspace'>
                {/* render: 시험 화면과 동일한 3문항 단위 문제 카드 및 페이지 이동 */}
                <section className='exam-paper' aria-label='채점 결과 문제' aria-busy={isLoading}>
                    <div className='exam-question-list'>
                        {isLoading ? <div className='exam-empty-state' role='status'><span className='exam-loading-dot' />채점 결과를 불러오고 있습니다.</div>
                            : resultError ? <div className='exam-empty-state' role='alert'><p>{resultError}</p><button type='button' className='exam-action-button' onClick={() => setLoadAttempt(value => value + 1)}>다시 불러오기</button></div>
                            : !totalCount ? <div className='exam-empty-state'><p>표시할 채점 문항이 없습니다.</p><button type='button' className='exam-action-button' onClick={() => navigator(MY_PAGE_ABSOLUTE_PATH)}>목록으로 돌아가기</button></div>
                            : viewList.map(question => <QuestionTableItem key={question.questionId} examResult={question} />)}
                    </div>
                    <div className='exam-actions'><TestPagination currentPage={isReady ? currentPage : 0} totalPage={isReady ? totalPage : 0} disabled={!isReady} onPageChange={onPageChangeHandler} /></div>
                </section>
                <aside className='exam-sidebar' aria-label='채점 결과 정보'>
                    {/* render: 읽기 전용 행형 답안 표기란과 문항 이동 */}
                    <section className='exam-side-card exam-answer-sheet' aria-labelledby='grade-answer-title'>
                        <h2 id='grade-answer-title'><span className='exam-side-icon'><TestIcon name='target' /></span>답안 표기란</h2>
                        <div className='exam-answer-list'>
                            {isReady ? questionList.map(question => <AnswerTableItem key={question.questionId} examResult={question} isCurrentPage={viewList.some(item => item.questionId === question.questionId)} onQuestionClick={onQuestionNavigateHandler} />)
                                : <p className='exam-side-placeholder'>{isLoading ? '답안을 불러오고 있습니다.' : '표시할 답안이 없습니다.'}</p>}
                        </div>
                        <div className='grade-answer-legend' aria-label='답안 표시 안내'><span className='is-correct'>정답 선택</span><span className='is-incorrect'>오답 선택</span><span className='is-unanswered'>미응답</span></div>
                        <p className='exam-answer-hint'>직접 선택한 답안만 표시합니다.<br />문항 번호를 누르면 해당 문제로 이동합니다.</p>
                    </section>
                    {/* render: 획득 점수는 API 값, 정답률은 현재 결과의 문항 수로 표시 */}
                    <section className='exam-side-card exam-progress' aria-labelledby='grade-progress-title'>
                        <div className='exam-side-heading'><h2 id='grade-progress-title'><span className='exam-side-icon'><TestIcon name='chart' /></span>채점 결과</h2><span>{totalCount}문항</span></div>
                        {isAllResults && <div className='grade-score'><span>최종 획득 점수</span><strong>{totalScore === undefined ? '—' : totalScore}<small>점</small></strong></div>}
                        {!isAllResults && <p className='grade-result-scope'>현재 복습 문항 기준</p>}
                        <div className='grade-accuracy-label'>정답률</div>
                        <div className='exam-progress-meter'><progress value={correctCount} max={totalCount || 1} aria-label='정답률' /><span>{isReady ? `${accuracy}%` : '—'}</span></div>
                        <dl><div><dt>정답 문항</dt><dd>{correctCount}문항</dd></div><div><dt>오답 문항</dt><dd>{incorrectCount}문항</dd></div><div><dt>미응답 문항</dt><dd>{unansweredCount}문항</dd></div></dl>
                        {!isAllResults && groupId && <button type='button' className='exam-action-button grade-return-button' onClick={() => navigator(GRADING_VIEW_ABSOLUTE_PATH(groupId, 'all'))}>전체 채점 결과 보기</button>}
                    </section>
                    <section className='exam-guide' aria-labelledby='grade-guide-title'>
                        <h2 id='grade-guide-title'><span className='exam-side-icon'><TestIcon name='guide' /></span>안내 사항</h2>
                        <ul><li>각 문항의 정답과 해설을 확인할 수 있습니다.</li><li>제출한 답안은 변경할 수 없습니다.</li><li>오답과 미응답 문항을 다시 학습해 보세요.</li></ul>
                        <button type='button' className='exam-action-button grade-return-button' onClick={() => navigator(MY_PAGE_ABSOLUTE_PATH)}><TestIcon name='left' />목록으로 돌아가기</button>
                    </section>
                </aside>
            </div>
            <TestFooter />
        </main>
    );
}
