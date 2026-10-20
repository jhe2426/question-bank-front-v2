import React, { useState } from 'react';

import './style.css';
import MyPagePath from 'src/types/aliases/my-page.alias';
import { LearningRecord } from 'src/types/interfaces';
import ChangePasswordPage from './ChangePasswordPage';
import StudyHistory from './StudyHistory';
import ServiceFooter from 'src/components/ServiceFooter';
import './responsive.css';

// component: 학습기록, 비밀번호 변경 화면 컴포넌트 //
export default function MyPage() {
    // state: 기존 메뉴 전환 상태 //
    const [page, setPage] = useState<MyPagePath>('study-history');

    // state: 학습 기록 화면에서 조회한 실제 목록을 공유하는 요약 정보 //
    const [learningRecords, setLearningRecords] = useState<LearningRecord[] | null>(null);

    // variable: 원본 목록의 순서를 바꾸지 않고 최근 응시 날짜 계산 //
    const latestRecord = learningRecords?.reduce<LearningRecord | null>((latest, record) => {
        const solvedTime = Date.parse(record.solvedDate);
        if (!Number.isFinite(solvedTime)) return latest;
        return !latest || solvedTime > Date.parse(latest.solvedDate) ? record : latest;
    }, null);

    // event handler: 기존 페이지 상태를 이용한 메뉴 변경 //
    const onPageChangeHandler = (nextPage: MyPagePath) => {
        setPage(nextPage);
    };

    // render: 실제 학습 요약, 메뉴, 선택한 콘텐츠 및 공통 푸터 //
    return (
        <main id='mypage-wrapper'>
            <section className='mypage-intro' aria-labelledby='mypage-title'>
                <div className='mypage-intro-copy'>
                    <span className='mypage-eyebrow'>MY PAGE</span>
                    <h1 id='mypage-title'>마이페이지</h1>
                    <p>학습 기록과 계정 정보를 한곳에서 관리하세요.</p>
                </div>
                <dl className='mypage-summary' aria-label='학습 요약'>
                    <div className='mypage-summary-card'><dt>총 학습 기록</dt><dd>{learningRecords === null ? '—' : <>{learningRecords.length}<small>건</small></>}</dd></div>
                    <div className='mypage-summary-card'><dt>최근 응시 날짜</dt><dd className='summary-date'>{latestRecord?.solvedDate || '—'}</dd></div>
                </dl>
            </section>
            <div className='mypage-workspace'>
                <aside className='mypage-sidebar' aria-label='마이페이지 메뉴'>
                    <h2>마이페이지</h2>
                    <nav className='navigation-list' aria-label='계정 및 학습 메뉴'>
                        <button type='button' className={`navigation${page === 'study-history' ? ' active' : ''}`} aria-current={page === 'study-history' ? 'page' : undefined} onClick={() => onPageChangeHandler('study-history')}><span>학습 기록</span><span className='mypage-menu-arrow' aria-hidden='true' /></button>
                        <button type='button' className={`navigation${page === 'change-password' ? ' active' : ''}`} aria-current={page === 'change-password' ? 'page' : undefined} onClick={() => onPageChangeHandler('change-password')}><span>비밀번호 변경</span><span className='mypage-menu-arrow' aria-hidden='true' /></button>
                    </nav>
                    <p className='mypage-sidebar-note'>오늘의 학습을 돌아보고<br />다음 도전을 준비하세요.</p>
                </aside>
                <div className='mypage-content'>
                    {page === 'study-history'
                        ? <StudyHistory onRecordsLoaded={setLearningRecords} />
                        : <ChangePasswordPage onPageChange={onPageChangeHandler} />}
                </div>
            </div>
            <ServiceFooter />
        </main>
    );
}
