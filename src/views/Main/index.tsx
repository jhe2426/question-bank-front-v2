import React, { useCallback, useEffect, useState } from 'react';

import './style.css';
import './responsive.css';
import UnitSelector from './UnitSelector';
import { getPastExamRoundListRequest, getUnitAndChapterListRequest } from 'src/apis';
import { useAuthStore } from 'src/stores';
import { useNavigate } from 'react-router';
import { INCORRECT_QUESTIONS_TEST_ABSOLUTE_PATH, KILLER_EXAM_TEST_ABSOLUTE_PATH, MESSAGE, MOCK_EXAM_TEST_ABSOLUTE_PATH, PAST_EXAM_TEST_ABSOLUTE_PATH, RESPONSE_CODE } from 'src/constants';
import { ResponseDto } from 'src/apis/dto/response';
import { Chapter, MockExamPathParams, PastExamRound, Unit, UnitSummary } from 'src/types/interfaces';
import { GetUnitAndChapterListResponseDto } from 'src/apis/dto/response/mockExam';
import { GetPastExamRoundListResponseDto } from 'src/apis/dto/response/pastExam';
import { IncorrectType } from 'src/types/aliases';

// type: 메인 화면 시험 유형 및 아이콘 종류 //
type ExamType = 'mock' | 'past' | 'killer' | 'incorrect';
type IconName = ExamType | 'arrow' | 'check' | 'settings' | 'clock';

// variable: 시험 유형 카드 안내 목록 //
const EXAM_TYPES: { type: ExamType; title: string; description: string; tag: string }[] = [
    { type: 'mock', title: '모의고사', description: '난이도와 단원을 선택하여 실력을 점검해 보세요.', tag: '맞춤 학습' },
    { type: 'past', title: '기출문제', description: '실제 기출문제를 회차별로 풀어보세요.', tag: '실전 연습' },
    { type: 'killer', title: '킬러문제', description: '고난도 문제를 집중적으로 학습해 보세요.', tag: '심화 학습' },
    { type: 'incorrect', title: '오답문제', description: '틀린 문제를 다시 풀며 부족한 부분을 보완하세요.', tag: '약점 보완' }
];

// variable: 기존 오답문제 API에서 지원하는 원본 시험 유형 //
const INCORRECT_TYPES: IncorrectType[] = ['모의고사', '기출문제', '킬러문제'];

// component: 메인 화면 공통 장식 아이콘 컴포넌트 //
function MainIcon({ name }: { name: IconName }) {

    // variable: 외부 이미지 없이 표시하는 아이콘 도형 //
    const paths: Record<IconName, React.ReactNode> = {
        mock: <><rect x='5' y='4' width='14' height='17' rx='2' /><rect x='9' y='2' width='6' height='4' rx='1' /><path d='m8 11 1 1 2-2m2 1h3m-8 5 1 1 2-2m2 1h3' /></>,
        past: <><path d='M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-2-10 1Z' /><path d='M12 5v16' /></>,
        killer: <><circle cx='12' cy='12' r='9' /><circle cx='12' cy='12' r='5' /><circle cx='12' cy='12' r='1' /></>,
        incorrect: <><path d='M6 3h12a1 1 0 0 1 1 1v17H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 14h13M7 3v9l3-2 3 2V3' /></>,
        arrow: <path d='M4 12h15m-6-6 6 6-6 6' />,
        check: <path d='m5 12 4 4L19 6' />,
        settings: <><path d='M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10' /><circle cx='9' cy='6' r='2' /><circle cx='15' cy='12' r='2' /><circle cx='9' cy='18' r='2' /></>,
        clock: <><circle cx='12' cy='12' r='9' /><path d='M12 7v5l3 2' /></>
    };

    // render: 스크린 리더에서 제외하는 장식 아이콘 렌더링 //
    return <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>{paths[name]}</svg>;
}

// component: 메인 화면 컴포넌트 //
export default function Main() {

    // state: accessToken 정보 상태 //
    const { accessToken } = useAuthStore();

    // state: 선택한 시험 유형 상태 //
    const [selectedExamType, setSelectedExamType] = useState<ExamType>('mock');

    // state: 단원 리스트 및 선택한 단원 상태 //
    const [unitList, setUnitList] = useState<Unit[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<UnitSummary | null>(null);
    // state: 선택한 챕터 상태 //
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

    // state: 모의고사 난이도 및 해설 보기 옵션 상태 //
    const [mockLevel, setMockLevel] = useState<string>('');
    const [isSolutionVisible, setIsSolutionVisible] = useState<boolean | null>(null);

    // state: 기출문제 회차 리스트 및 선택한 회차 상태 //
    const [pastExamRoundList, setPastExamRoundList] = useState<PastExamRound[]>([]);
    const [selectedPastExamRound, setSelectedPastExamRound] = useState<PastExamRound | null>(null);

    // state: 선택한 오답문제 타입 상태 //
    const [selectedIncorrectType, setSelectedIncorrectType] = useState<IncorrectType | ''>('');

    // state: 단원 및 기출문제 목록 로딩과 오류 상태 //
    const [isUnitLoading, setIsUnitLoading] = useState<boolean>(true);
    const [isPastLoading, setIsPastLoading] = useState<boolean>(true);
    const [unitError, setUnitError] = useState<string>('');
    const [pastError, setPastError] = useState<string>('');

    // variable: RESPONSE CODE 구조 분해 상수 //
    const { AUTHENTICATION_FAILED, SUCCESS } = RESPONSE_CODE;

    // variable: 선택한 단원에 속한 챕터 목록 //
    const chapterOptionList = unitList.find(unit => unit.unitId === selectedUnit?.unitId)?.chapters ?? [];

    // variable: 선택한 시험 유형의 안내 정보 //
    const selectedExam = EXAM_TYPES.find(exam => exam.type === selectedExamType)!;

    // variable: 유형별 필수 입력 및 시작 버튼 활성화 조건 //
    const isMockExamButtonActive = mockLevel !== '' && isSolutionVisible !== null && selectedUnit !== null && selectedChapter !== null && !isUnitLoading && !unitError;
    const isPastExamButtonActive = selectedPastExamRound !== null && !isPastLoading && !pastError;
    const isIncorrectTypeButtonActive = selectedIncorrectType !== '';
    const isStartButtonActive = selectedExamType === 'mock' ? isMockExamButtonActive
        : selectedExamType === 'past' ? isPastExamButtonActive
        : selectedExamType === 'incorrect' ? isIncorrectTypeButtonActive : true;

    // variable: 시험 시작 전 필수 입력 안내 //
    const startGuide = selectedExamType === 'mock' ? '난이도, 해설 보기, 단원과 챕터를 모두 선택해 주세요.'
        : selectedExamType === 'past' ? '회차를 선택하고 실전처럼 연습해 보세요.'
        : selectedExamType === 'incorrect' ? '복습할 문제 유형을 선택해 주세요.'
        : '준비가 되었다면 고난도 문제에 도전해 보세요.';

    // function: 네비게이터 함수 //
    const navigator = useNavigate();

    // function: get unit and chapter list response 처리 함수 //
    const getUnitAndChapterListResponse = useCallback((responseBody: GetUnitAndChapterListResponseDto | ResponseDto | null) => {
        setIsUnitLoading(false);
        if (!responseBody || responseBody.code !== SUCCESS) {
            const message = responseBody?.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED : MESSAGE.SERVER_ERROR;
            setUnitError(message);
            alert(message);
            return;
        }

        const { units } = responseBody as GetUnitAndChapterListResponseDto;
        setUnitList(units);
        setUnitError('');
    }, [AUTHENTICATION_FAILED, SUCCESS]);

    // function: get past exam round list response 처리 함수 //
    const getPastExamRoundListResponse = useCallback((responseBody: GetPastExamRoundListResponseDto | ResponseDto | null) => {
        setIsPastLoading(false);
        if (!responseBody || responseBody.code !== SUCCESS) {
            const message = responseBody?.code === AUTHENTICATION_FAILED ? MESSAGE.AUTHENTICATION_FAILED : MESSAGE.SERVER_ERROR;
            setPastError(message);
            alert(message);
            return;
        }

        const { pastExamRounds } = responseBody as GetPastExamRoundListResponseDto;
        setPastExamRoundList(pastExamRounds);
        setPastError('');
    }, [AUTHENTICATION_FAILED, SUCCESS]);

    // event handler: 모의고사 난이도 선택 이벤트 처리 //
    const onMockLevelSelectHandler = (selectedMockLevel: string) => {
        setMockLevel(current => current === selectedMockLevel ? '' : selectedMockLevel);
    };

    // event handler: 단원 선택 시 이전 챕터 선택 초기화 //
    const onUnitOptionSelectHandler = (unit: UnitSummary) => {
        setSelectedUnit(unit);
        setSelectedChapter(null);
    };

    // event handler: 모의고사 버튼 클릭 이벤트 처리 //
    const onMockExamClickHandler = () => {
        if (!isMockExamButtonActive || !selectedUnit || !selectedChapter || isSolutionVisible === null) return;

        const mockExamParams: MockExamPathParams = {
            unitId: selectedUnit.unitId,
            chapterId: selectedChapter.chapterId,
            difficulty: mockLevel,
            hasExplanation: isSolutionVisible
        };
        navigator(MOCK_EXAM_TEST_ABSOLUTE_PATH(mockExamParams));
    };

    // event handler: 기출문제 버튼 클릭 이벤트 처리 //
    const onPastExamClickHandler = () => {
        if (!isPastExamButtonActive || !selectedPastExamRound) return;
        navigator(PAST_EXAM_TEST_ABSOLUTE_PATH(selectedPastExamRound.pastExamId, selectedPastExamRound.pastExamRound));
    };

    // event handler: 킬러문제 버튼 클릭 이벤트 처리 //
    const onKillerClickHandler = () => {
        navigator(KILLER_EXAM_TEST_ABSOLUTE_PATH);
    };

    // event handler: 오답문제 버튼 클릭 이벤트 처리 //
    const onIncorrectClickHandler = () => {
        if (!selectedIncorrectType) return;
        navigator(INCORRECT_QUESTIONS_TEST_ABSOLUTE_PATH(selectedIncorrectType));
    };

    // event handler: 선택한 유형의 기존 시험 시작 함수 실행 //
    const onExamStartHandler = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isStartButtonActive) return;

        if (selectedExamType === 'mock') onMockExamClickHandler();
        else if (selectedExamType === 'past') onPastExamClickHandler();
        else if (selectedExamType === 'killer') onKillerClickHandler();
        else onIncorrectClickHandler();
    };

    // event handler: 실패한 목록 다시 불러오기 //
    const onListRetryClickHandler = () => {
        if (!accessToken) return;
        if (selectedExamType === 'mock') {
            setIsUnitLoading(true);
            setUnitError('');
            getUnitAndChapterListRequest(accessToken).then(getUnitAndChapterListResponse);
        } else if (selectedExamType === 'past') {
            setIsPastLoading(true);
            setPastError('');
            getPastExamRoundListRequest(accessToken).then(getPastExamRoundListResponse);
        }
    };

    // effect: accessToken이 변경될 시 기존 API로 설정 목록 조회 //
    useEffect(() => {
        if (!accessToken) return;

        // variable: 이전 요청이 화면 전환 후 상태를 갱신하지 않도록 하는 플래그 //
        let isActive = true;
        setIsUnitLoading(true);
        setIsPastLoading(true);
        getUnitAndChapterListRequest(accessToken).then(response => {
            if (isActive) getUnitAndChapterListResponse(response);
        });
        getPastExamRoundListRequest(accessToken).then(response => {
            if (isActive) getPastExamRoundListResponse(response);
        });
        return () => { isActive = false; };
    }, [accessToken, getUnitAndChapterListResponse, getPastExamRoundListResponse]);

    // render: 메인 화면 컴포넌트 렌더링 //
    return (
        <main id='main-wrapper'>
            {/* render: 서비스 소개 및 학습 이미지 영역 */}
            <section className='main-hero' aria-labelledby='hero-title'>
                <div className='hero-copy'>
                    <span className='hero-eyebrow'><span /> ADsP LEARNING PLATFORM</span>
                    <h1 id='hero-title'>합격을 위한 준비,<br /><span>한 문제부터 시작하세요.</span></h1>
                    <p>모의고사부터 기출문제, 킬러문제, 오답 복습까지<br className='desktop-break' /> 한곳에서 학습하세요.</p>
                    <a className='hero-link' href='#exam-types'>학습 시작하기 <MainIcon name='arrow' /></a>
                    <ul className='hero-features'>
                        {['유형별 문제 학습', '자동 채점', '오답 관리'].map(feature => (
                            <li key={feature}><MainIcon name='check' />{feature}</li>
                        ))}
                    </ul>
                </div>
                <div className='hero-art' aria-hidden='true'>
                    <div className='art-orbit orbit-one' />
                    <div className='art-orbit orbit-two' />
                    <div className='art-spark spark-one' /><div className='art-spark spark-two' />
                    <div className='art-paper'>
                        <div className='paper-header'><span>ADsP</span><MainIcon name='mock' /></div>
                        <div className='paper-subtitle'>나의 합격 준비 노트</div>
                        <div className='paper-rule' />
                        {[0, 1, 2].map(index => (
                            <div className='paper-row' key={index}><span><MainIcon name='check' /></span><div><i /><i /></div></div>
                        ))}
                        <div className='paper-footer'>한 문제씩, 더 확실하게.</div>
                    </div>
                    <div className='art-chart'>
                        <div className='chart-label'>LEARNING RECORD</div>
                        <div className='chart-content'><div className='chart-ring'><MainIcon name='check' /></div><div className='chart-bars'><i /><i /><i /><i /></div></div>
                        <span>차곡차곡 쌓이는 나의 실력</span>
                    </div>
                    <div className='art-badge'><MainIcon name='check' /></div>
                </div>
            </section>

            {/* render: 통계 수치 대신 실제 제공하는 학습 기능 안내 */}
            <section className='learning-overview' aria-label='학습 기능 안내'>
                <div className='overview-item'><span className='overview-icon'><MainIcon name='mock' /></span><div><h2>나에게 맞는 학습</h2><p>유형과 난이도를 선택해 시작하세요</p></div></div>
                <div className='overview-item'><span className='overview-icon'><MainIcon name='check' /></span><div><h2>풀이 후 자동 채점</h2><p>학습 결과를 바로 확인하세요</p></div></div>
                <div className='overview-item'><span className='overview-icon'><MainIcon name='incorrect' /></span><div><h2>오답으로 한 번 더</h2><p>틀린 문제를 복습하며 완성하세요</p></div></div>
            </section>

            {/* render: 공통 설정 영역과 연결된 시험 유형 선택 카드 */}
            <section id='exam-types' className='exam-catalog' aria-labelledby='exam-types-title'>
                <div className='section-heading'>
                    <div><span className='section-eyebrow'>CHOOSE YOUR PRACTICE</span><h2 id='exam-types-title'>시험 유형 선택</h2></div>
                    <p>오늘의 학습 목표에 맞는 유형을 선택하세요.</p>
                </div>
                <div className='exam-type-grid' role='group' aria-label='시험 유형'>
                    {EXAM_TYPES.map(exam => (
                        <button
                            key={exam.type}
                            type='button'
                            className={`exam-type-card${selectedExamType === exam.type ? ' is-selected' : ''}`}
                            aria-pressed={selectedExamType === exam.type}
                            aria-controls='exam-settings'
                            onClick={() => setSelectedExamType(exam.type)}
                        >
                            <span className='exam-card-top'><span className={`exam-card-icon ${exam.type}`}><MainIcon name={exam.type} /></span><span className='exam-card-tag'>{exam.tag}</span></span>
                            <span className='exam-card-title'>{exam.title}</span>
                            <span className='exam-card-description'>{exam.description}</span>
                            <span className='exam-card-action'>{selectedExamType === exam.type ? '선택됨' : '선택하기'}<MainIcon name={selectedExamType === exam.type ? 'check' : 'arrow'} /></span>
                        </button>
                    ))}
                </div>
            </section>

            {/* render: 선택한 시험 유형의 옵션만 표시하는 공통 시험 설정 */}
            <section id='exam-settings' className='exam-settings' aria-labelledby='exam-settings-title'>
                <div className='settings-heading'>
                    <div className='settings-title-group'><span className='settings-icon'><MainIcon name='settings' /></span><div><span className='section-eyebrow'>시험 설정</span><h2 id='exam-settings-title' aria-live='polite'>{selectedExam.title} 설정</h2></div></div>
                    <span className='settings-step'>옵션 선택 후 학습을 시작하세요</span>
                </div>
                <form onSubmit={onExamStartHandler}>
                    {selectedExamType === 'mock' && (
                        <div className='settings-body mock-settings'>
                            <div className='settings-column'>
                                <fieldset className='option-fieldset'>
                                    <legend>난이도 선택 <span className='required-label'>필수</span></legend>
                                    <div className='difficulty-options' role='group' aria-label='모의고사 난이도'>
                                        {['상', '중', '하'].map(level => (
                                            <button type='button' key={level} className={`difficulty-button${mockLevel === level ? ' is-selected' : ''}`} aria-pressed={mockLevel === level} onClick={() => onMockLevelSelectHandler(level)}>{level}</button>
                                        ))}
                                    </div>
                                </fieldset>
                                <fieldset className='option-fieldset'>
                                    <legend>해설 보기 옵션 <span className='required-label'>필수</span></legend>
                                    <div className='solution-options'>
                                        {[true, false].map(visible => (
                                            <label key={String(visible)} className={`choice-option${isSolutionVisible === visible ? ' is-selected' : ''}`}>
                                                <input type='radio' name='solution' checked={isSolutionVisible === visible} onChange={() => setIsSolutionVisible(visible)} required />
                                                <span>{visible ? '해설을 보고 문제 풀기' : '해설을 보지 않고 문제 풀기'}</span>
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            </div>
                            <div className='settings-column unit-settings' aria-busy={isUnitLoading}>
                                <UnitSelector title='단원별 문제' options={unitList} selectedItem={selectedUnit} onOptionClickHanlder={onUnitOptionSelectHandler} getOptionName={option => option.unitName} getOptionValue={option => option.unitId} placeholder={isUnitLoading ? '단원을 불러오는 중입니다' : unitError ? '단원을 불러오지 못했습니다' : unitList.length ? '단원을 선택하세요' : '등록된 단원이 없습니다'} disabled={isUnitLoading || !!unitError} />
                                {selectedUnit && (
                                    <UnitSelector title='챕터별 문제' options={chapterOptionList} selectedItem={selectedChapter} onOptionClickHanlder={setSelectedChapter} getOptionName={option => option.chapterName} getOptionValue={option => option.chapterId} placeholder={chapterOptionList.length ? '챕터를 선택하세요' : '등록된 챕터가 없습니다'} disabled={isUnitLoading || !!unitError} />
                                )}
                                <p className='field-help'>{selectedUnit ? '선택한 단원의 챕터까지 선택하면 준비가 완료됩니다.' : '단원을 선택하면 해당 단원의 챕터가 표시됩니다.'}</p>
                                {unitError && <div className='list-error' role='alert'><span>{unitError}</span><button type='button' onClick={onListRetryClickHandler}>다시 불러오기</button></div>}
                            </div>
                        </div>
                    )}

                    {selectedExamType === 'past' && (
                        <div className='settings-body past-settings' aria-busy={isPastLoading}>
                            <div className='settings-column'>
                                <UnitSelector title='기출문제 회차 선택' options={pastExamRoundList} selectedItem={selectedPastExamRound} onOptionClickHanlder={setSelectedPastExamRound} getOptionName={option => `${option.pastExamRound}회차`} getOptionValue={option => option.pastExamId} placeholder={isPastLoading ? '회차를 불러오는 중입니다' : pastError ? '회차를 불러오지 못했습니다' : pastExamRoundList.length ? '회차를 선택하세요' : '등록된 기출문제가 없습니다'} disabled={isPastLoading || !!pastError} />
                                <p className='field-help'>원하는 회차를 선택한 뒤 기출문제 풀기를 눌러 주세요.</p>
                                {pastError && <div className='list-error' role='alert'><span>{pastError}</span><button type='button' onClick={onListRetryClickHandler}>다시 불러오기</button></div>}
                            </div>
                            <div className='practice-note'><MainIcon name='clock' /><div><h3>실전 감각을 기르는 시간</h3><p>시험이 시작되면 제한 시간 안에 문제를 풀고,<br className='desktop-break' /> 제출 후 채점 결과를 확인할 수 있어요.</p></div></div>
                        </div>
                    )}

                    {selectedExamType === 'killer' && (
                        <div className='settings-body killer-settings'>
                            <span className='killer-target'><MainIcon name='killer' /></span>
                            <div><span className='section-eyebrow'>한 단계 더 깊이 있는 학습</span><h3>고난도 문제에 도전해 보세요.</h3><p>킬러문제를 집중적으로 풀며 헷갈리는 개념을 점검하세요.<br className='desktop-break' /> 별도의 옵션 선택 없이 바로 시작할 수 있어요.</p></div>
                        </div>
                    )}

                    {selectedExamType === 'incorrect' && (
                        <div className='settings-body incorrect-settings'>
                            <fieldset className='option-fieldset'>
                                <legend>오답 범위 선택 <span className='required-label'>필수</span></legend>
                                <p className='field-help'>복습할 유형을 하나 선택하세요. 틀린 문제를 다시 풀 수 있어요.</p>
                                <div className='incorrect-options'>
                                    {INCORRECT_TYPES.map(type => (
                                        <label className={`choice-option${selectedIncorrectType === type ? ' is-selected' : ''}`} key={type}>
                                            <input type='radio' name='incorrect-type' checked={selectedIncorrectType === type} onChange={() => setSelectedIncorrectType(type)} required />
                                            <span>{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        </div>
                    )}

                    {/* render: 유형별 필수 조건을 만족할 때 활성화되는 공통 시작 버튼 */}
                    <div className='settings-footer'>
                        <p id='exam-start-guide'><MainIcon name='check' />{isStartButtonActive ? '학습 준비가 완료되었어요. 지금 시작해 보세요!' : startGuide}</p>
                        <button type='submit' className='exam-start-button' disabled={!isStartButtonActive} aria-describedby='exam-start-guide'>{selectedExam.title} 풀기<MainIcon name='arrow' /></button>
                    </div>
                </form>
            </section>

            {/* render: 서비스 하단 안내 */}
            <footer className='main-footer'><span className='footer-brand'>ADsP 문제은행</span><p>오늘의 한 문제가 내일의 자신감으로</p><span>꾸준한 학습, 확실한 준비</span></footer>
        </main>
    );
}
