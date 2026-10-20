import React, { useCallback, useEffect, useRef, useState } from 'react';

import './style.css';
import { GetLearningRecordListResponseDto } from 'src/apis/dto/response/myPage';
import { ResponseDto } from 'src/apis/dto/response';
import { GRADING_VIEW_ABSOLUTE_PATH, MESSAGE, RESPONSE_CODE } from 'src/constants';
import { usePagination } from 'src/hooks';
import { useAuthStore } from 'src/stores';
import { getLearningRecordListRequest, getUnitGradingResultListRequest } from 'src/apis';
import { useNavigate } from 'react-router';
import { LearningRecord, UnitGradingResult } from 'src/types/interfaces';
import GetUnitGradingResultListResponseDto from 'src/apis/dto/response/myPage/get-unit-grading-result-list.response.dto';

// interface: 학습기록 테이블 레코드 컴포넌트 속성 //
interface TableItemProps {
    accessToken: string | null;
    index: number;
    learningRecord: LearningRecord;
}

// component: 학습기록 테이블 레코드 컴포넌트 //
function TableItem({ accessToken, index, learningRecord }: TableItemProps) {

    const { groupId, solvedDate, detailedType, totalScore } = learningRecord;

    // state: 틀린문제 기출시험 상세 결과 오픈 여부 상태 //
    const [isPastExamDetailOpen, setIsPastExamDetailOpen] = useState<boolean> (false);

    // state: 기출문제 단원별 시험 결과 리스트 //
    const [unitGradingResultList, setUnitGradingResultList] = useState<UnitGradingResult[]>([]);

    // state: 기출문제 과락 여부 상태 //
    const [hasPastExamFailUnit, setHasPastExamFailUnit] = useState<boolean>(false);

    // variable: 문제 유형이 기출문제인지 판별 //
    const isPastExam = detailedType?.includes('기출문제') && !detailedType?.includes('기출문제 오답');

    // state: 과목별 결과 조회의 로딩·오류 표시 상태 //
    const [isUnitLoading, setIsUnitLoading] = useState(true);
    const [unitError, setUnitError] = useState('');

    // variable: 기존 60점·과락 기준을 문구와 색상에 동일하게 적용 //
    const isPassed = !hasPastExamFailUnit && totalScore >= 60;
    const resultPending = isPastExam && (isUnitLoading || !!unitError || unitGradingResultList.length === 0);
    const examResultText = !isPastExam ? '-' : resultPending ? (isUnitLoading ? '확인 중' : '확인 필요') : isPassed ? '합격' : '불합격';

    // variable: 틀린문제 아이콘 클래스 //
    const incorrectClass = !isPastExam ? 'incorrect-icon' : isPastExamDetailOpen ? 'past-exam-incorrect-up-arrow-icon' : 'past-exam-incorrect-icon';

    // variable: 합격 여부 클래스 //
    const examResultClass = !isPastExam || resultPending ? 'td study-history-exam-result' : isPassed ? 'td study-history-exam-result pass' : 'td study-history-exam-result fail';

    // variable: RESPONSE CODE 구조 분해 상수 //
    const {  
        AUTHENTICATION_FAILED, DATABASE_ERROR, NO_PERMISSION, NOT_EXIST_GROUP_ID, SUCCESS
    } = RESPONSE_CODE;

    // reference: 아코디언 외부 클릭을 판별하는 학습 기록 행 참조 //
    const rowRef = useRef<HTMLTableSectionElement>(null);
    
    // function: 네비게이터 함수 //
    const navigator = useNavigate();

    // function: get unit grading result list response 처리 함수 //
    const getUnitGradingResultListResponse = useCallback((responseBody: GetUnitGradingResultListResponseDto | ResponseDto | null) => {
        setIsUnitLoading(false);
        const message =
            !responseBody ? MESSAGE.SERVER_ERROR :
            responseBody.code === DATABASE_ERROR ?  MESSAGE.SERVER_ERROR :
            responseBody.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED :
            responseBody.code === NO_PERMISSION ? MESSAGE.NO_PERMISSION :
            responseBody.code === NOT_EXIST_GROUP_ID ? '존재하지 않는 그룹 번호입니다' : '';

        const isSuccess = responseBody !== null && responseBody.code === SUCCESS;
        if (!isSuccess) {
            setUnitError(message || MESSAGE.SERVER_ERROR);
            alert(message);
            return;
        }

        setUnitError('');
        const { unitGradingResults } = responseBody as GetUnitGradingResultListResponseDto;
        setUnitGradingResultList(unitGradingResults);
        setHasPastExamFailUnit(unitGradingResults.some(result => !result.passed));
    }, [AUTHENTICATION_FAILED, DATABASE_ERROR, NO_PERMISSION, NOT_EXIST_GROUP_ID, SUCCESS]);

    // event handler: 틀린 문제 보기 아이콘 클릭 이벤트 처리 //
    const onIncorrectQuestionsClick = () => {
        if (isPastExam) {
            const nextOpen = !isPastExamDetailOpen;
            setIsPastExamDetailOpen(nextOpen);
            if (nextOpen) {
                if (accessToken === null) return;
                setIsUnitLoading(true);
                setUnitError('');
                getUnitGradingResultListRequest(accessToken, groupId).then(getUnitGradingResultListResponse);
            }
            return;
        }
        if (totalScore >= 100) {
            alert('틀린 문제가 존재하지않습니다');
            return;
        }
        navigator(GRADING_VIEW_ABSOLUTE_PATH(groupId, 'incorrect'));
    }
    
    // event handler: 틀린 문제 버튼 클릭 이벤트 처리 // 
    const onIncorrectQuestionsButtonCliciki = () => {
        if (totalScore >= 100) {
            alert('틀린 문제가 존재하지않습니다');
            return;
        }
        navigator(GRADING_VIEW_ABSOLUTE_PATH(groupId, 'incorrect'));
    };

    // event handler: 전체 문제 보기 아이콘 클릭 이벤트 처리 //
    const onAllQuestionsClick = () => {
        navigator(GRADING_VIEW_ABSOLUTE_PATH(groupId, 'all'));
    };
    
    // effect:  틀린문제 기출시험 상세 결과 오픈 상태가 변경 될 시 실행할 함수 //
    useEffect(() => {    
        const onOutsideClickHandler = (event: MouseEvent) => {
            if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
                setIsPastExamDetailOpen(false);
            }
        };

        if (!isPastExamDetailOpen) return;

        document.addEventListener('mousedown', onOutsideClickHandler);

        return () => {
            document.removeEventListener('mousedown', onOutsideClickHandler);
        };

    }, [isPastExamDetailOpen]);


    // effect: 컴포넌트 로드 시 실행할 함수 //
    useEffect(() => {
        if (accessToken === null) return;

        if (isPastExam) {
            getUnitGradingResultListRequest(accessToken, groupId).then(getUnitGradingResultListResponse);
        }
    }, [accessToken, groupId, isPastExam, getUnitGradingResultListResponse]);

    // render: 기존 아이콘과 이동 함수를 연결한 기록 행 및 기출 상세 카드 //
    return (
        <tbody className={`study-history-row${isPastExamDetailOpen ? ' is-expanded' : ''}`} ref={rowRef}>
            <tr className='tr'>
                <td className='td study-history-number'>{index}</td>
                <td className='td study-history-date'>{solvedDate}</td>
                <td className='td study-history-source-type'>{detailedType}</td>
                <td className='td study-history-score'>{totalScore}</td>
                <td className='td study-history-incorrect'>
                    <button type='button' className='history-icon-button' onClick={onIncorrectQuestionsClick} aria-label={`${detailedType} ${index}번 기록 ${isPastExam ? '과목별 결과' : '틀린 문제'} 보기`} aria-expanded={isPastExam ? isPastExamDetailOpen : undefined} aria-controls={isPastExam ? `past-exam-detail-${groupId}` : undefined}>
                        <span className={incorrectClass} aria-hidden='true' />
                    </button>
                </td>
                <td className='td study-history-total'>
                    <button type='button' className='history-icon-button' onClick={onAllQuestionsClick} aria-label={`${detailedType} ${index}번 기록 전체 문제 보기`}><span className='total-question-icon' aria-hidden='true' /></button>
                </td>
                <td className={examResultClass}><span className='history-result-badge'>{examResultText}</span></td>
            </tr>
            {isPastExam && (
                <tr className='history-detail-row' hidden={!isPastExamDetailOpen}>
                    <td colSpan={7}>
                        <div id={`past-exam-detail-${groupId}`} className={`past-exam-result-detail-wrapper${isPastExamDetailOpen ? ' open' : ''}`}>
                            <div className='past-exam-result-detail' aria-label={`${detailedType} 과목별 결과`} aria-busy={isUnitLoading}>
                                <div className='unit-score-content'>
                                    {isUnitLoading ? <p className='history-feedback' role='status'>과목별 결과를 불러오고 있습니다.</p>
                                        : unitError ? <p className='history-feedback' role='alert'>{unitError}</p>
                                        : unitGradingResultList.length === 0 ? <p className='history-feedback'>표시할 과목별 결과가 없습니다.</p>
                                        : <table className='unit-score-card'>
                                            <thead><tr className='unit-score-card-header'><th scope='col'>과목명</th><th scope='col'>정답 수 / 전체 문항 수</th></tr></thead>
                                            <tbody>{unitGradingResultList.map(unit => (
                                                <tr className='unit-score-item' key={unit.unitId}>
                                                    <th scope='row' className='unit-name'>{unit.unitName}</th>
                                                    <td><span className={`unit-score-badge ${unit.passed ? 'pass' : 'fail'}`} aria-label={`${unit.correctCount} / ${unit.unitId === 3 ? 30 : 10}문항, ${unit.passed ? '과락 없음' : '과락'}`}>{unit.correctCount} / {unit.unitId === 3 ? 30 : 10}</span></td>
                                                </tr>
                                            ))}</tbody>
                                        </table>}
                                    <button type='button' className='incorrect-question-button' onClick={onIncorrectQuestionsButtonCliciki}>틀린 문제 보러가기</button>
                                </div>
                                <div className='unit-result-guide'><span aria-hidden='true'>!</span><p>기출문제는 총점과 과목별 과락 여부에 따라 합격 여부가 결정됩니다.<br /><strong>부족한 과목을 확인하고 다시 복습해 보세요.</strong></p></div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </tbody>
    );
}

// interface: 기존 조회 결과를 상단 학습 요약과 공유하는 속성 //
interface Props {
    onRecordsLoaded: (records: LearningRecord[] | null) => void;
}

// component: 학습기록 화면 컴포넌트 //
export default function StudyHistory({ onRecordsLoaded }: Props) {

    // variable: 페이지당 학습 기록 수 //
    const LEARNING_RECORD_COUNT_PER_PAGE = 8;

    // state: accessToken 정보 상태 //
    const { accessToken } = useAuthStore();

    // state: 학습기록 리스트 //
    const [learningRecordList, setLearningRecordList] = useState<LearningRecord[] | null>(null);

    // state: 목록 조회 중·오류 및 재시도 상태 //
    const [isLoading, setIsLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [loadAttempt, setLoadAttempt] = useState(0);

    // state: 페이지네이션 상태 //
    const {
        currentPage, setCurrentPage, currentSection, setCurrentSection, totalSection, 
        pageList, viewList,
        setTotalList
    } = usePagination<LearningRecord>(LEARNING_RECORD_COUNT_PER_PAGE);

    // variable: RESPONSE CODE 구조 분해 상수 //
    const { 
    AUTHENTICATION_FAILED, DATABASE_ERROR, SUCCESS
    } = RESPONSE_CODE;

    // variable: learningRecordList가 null 또는 비어있는지 확인 //
    const isLearningRecordListEmpty = learningRecordList === null || learningRecordList.length === 0;

    // variable: 이전 섹션 버튼 문자열 //
    const preButtonClass = currentSection <= 1 ? 'pagination-button left disable' : 'pagination-button left';
    // variable: 다음 섹션 버튼 문자열 //
    const nextButtonClass = currentSection === totalSection ? 'pagination-button right disable' : 'pagination-button right';

    // function: 페이지 클래스 //
    const pageClass = (page: number) => currentPage === page ? 'page active' : 'page';

    // function: get learning record list response 처리 함수 //
    const getLearningRecordListResponse = useCallback((responseBody: GetLearningRecordListResponseDto | ResponseDto | null) => {
        setIsLoading(false);
        const message = 
            !responseBody ? MESSAGE.SERVER_ERROR :
            responseBody.code === DATABASE_ERROR ? MESSAGE.SERVER_ERROR :
            responseBody.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED : '';

        const isSuccess = responseBody !== null && responseBody.code === SUCCESS;
        if (!isSuccess) {
            setListError(message || MESSAGE.SERVER_ERROR);
            alert(message);
            return;
        }
        
        const { learningRecords } = responseBody as GetLearningRecordListResponseDto;
        setTotalList(learningRecords);
        setLearningRecordList(learningRecords);
        onRecordsLoaded(learningRecords);

    }, [AUTHENTICATION_FAILED, DATABASE_ERROR, SUCCESS, onRecordsLoaded, setTotalList]);

    // event handler: 페이지 변경 이벤트 처리 //
     const onPageClickHandler = (page: number) => {
        setCurrentPage(page);
    };
    
    // event handler: 이전 섹션 클릭 이벤트 처리 //
    const onPreSectionClickHandler = () => {
        if (currentSection <= 1) return;
        setCurrentSection(currentSection - 1);
        setCurrentPage((currentSection - 1) * 10);
    };
  
    // event handler: 다음 섹션 클릭 이벤트 처리 //
    const onNextSectionClickHandler = () => {
        if (currentSection === totalSection) return;
        setCurrentSection(currentSection + 1);
        setCurrentPage(currentSection * 10 + 1);
    };

    // effect: accessToken이 변경될 시 실행할 함수 //
    useEffect(() => {
        if (accessToken === null) return;

        setIsLoading(true);
        setListError('');
        setCurrentPage(0);
        onRecordsLoaded(null);
        getLearningRecordListRequest(accessToken).then(getLearningRecordListResponse);
    }, [accessToken, getLearningRecordListResponse, loadAttempt, onRecordsLoaded, setCurrentPage]);

    // render: 실제 기록 표, 상태 안내 및 기존 10개 페이지 번호 단위 이동 //
    return (
        <section id='study-history-container' aria-labelledby='study-history-title'>
            <header className='mypage-content-heading'><div><h2 id='study-history-title'>학습 기록</h2><p>응시 기록을 확인하고 오답 및 전체 문제를 다시 볼 수 있습니다.</p></div>{!isLoading && !listError && <span className='history-count'>총 {learningRecordList?.length || 0}건</span>}</header>
            <p className='history-scroll-hint'>표를 좌우로 움직여 모든 항목을 확인하세요.</p>
            <div className='history-table-scroll' role='region' aria-label='학습 기록 표, 작은 화면에서 가로로 스크롤할 수 있습니다' tabIndex={0} aria-busy={isLoading}>
                <table className='study-history-table'>
                    <caption className='mypage-sr-only'>응시 기록별 점수와 문제 조회</caption>
                    <thead><tr className='tr'>
                        <th scope='col' className='th study-history-number'>번호</th>
                        <th scope='col' className='th study-history-date'>날짜</th>
                        <th scope='col' className='th study-history-source-type'>문제 유형</th>
                        <th scope='col' className='th study-history-score'>점수</th>
                        <th scope='col' className='th study-history-incorrect'>틀린 문제</th>
                        <th scope='col' className='th study-history-total'>전체 문제</th>
                        <th scope='col' className='th study-history-exam-result'>합격 여부</th>
                    </tr></thead>
                    {!isLoading && !listError && !isLearningRecordListEmpty && viewList.map((learningRecord, index) => <TableItem key={learningRecord.groupId} accessToken={accessToken} index={(currentPage - 1) * LEARNING_RECORD_COUNT_PER_PAGE + index + 1} learningRecord={learningRecord} />)}
                </table>
            </div>
            {isLoading ? <div className='empty-message' role='status'>학습 기록을 불러오고 있습니다.</div>
                : listError ? <div className='empty-message' role='alert'><p>{listError}</p><button type='button' className='mypage-secondary-button' onClick={() => setLoadAttempt(value => value + 1)}>다시 불러오기</button></div>
                : isLearningRecordListEmpty ? <div className='empty-message'><strong>아직 학습한 기록이 없습니다.</strong><p>시험을 완료하면 학습 기록을 확인할 수 있습니다.</p></div>
                : <nav className='pagination-container' aria-label='학습 기록 페이지 이동'>
                    <div className='pagination-box'>
                        <button type='button' className={preButtonClass} disabled={currentSection <= 1} onClick={onPreSectionClickHandler} aria-label='이전 10개 페이지' />
                        <div className='pagination'>{pageList.map(page => <button type='button' key={page} className={pageClass(page)} aria-current={currentPage === page ? 'page' : undefined} onClick={() => onPageClickHandler(page)}>{page}</button>)}</div>
                        <button type='button' className={nextButtonClass} disabled={currentSection >= totalSection} onClick={onNextSectionClickHandler} aria-label='다음 10개 페이지' />
                    </div>
                </nav>}
        </section>
    );
}
