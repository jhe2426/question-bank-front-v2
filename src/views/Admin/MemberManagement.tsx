import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from 'src/stores';
import { adminMemberDataSource } from './admin-member-data';
import { AdminMemberDataSource, AdminMemberLearningDetail, AdminMemberPage, AdminMemberSummary } from './admin-member.types';

type LoadState = 'loading' | 'ready' | 'error';

function MemberIcon({ name, size = 22 }: { name: 'user' | 'clock' | 'document' | 'close' | 'search'; size?: number }) {
    const paths = {
        user: <><circle cx='12' cy='8' r='4' /><path d='M4 21v-2a8 8 0 0 1 16 0v2' /></>,
        clock: <><circle cx='12' cy='12' r='9' /><path d='M12 7v5l3 2' /></>,
        document: <><path d='M6 3h9l3 3v15H6z' /><path d='M14 3v4h4M9 11h6M9 15h6' /></>,
        close: <path d='m6 6 12 12M18 6 6 18' />,
        search: <><circle cx='10.5' cy='10.5' r='7.5' /><path d='m16 16 5 5' /></>
    };
    return <svg aria-hidden='true' width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>{paths[name]}</svg>;
}

export function formatLearningTime(totalSeconds: number | null) {
    if (totalSeconds === null) return '기록 없음';
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    const parts = [
        hours ? `${hours}시간` : '',
        minutes ? `${minutes}분` : '',
        seconds ? `${seconds}초` : ''
    ].filter(Boolean);
    return parts.length ? parts.join(' ') : '0초';
}

export function formatAccuracyRate(accuracyRate: number) {
    return `${accuracyRate.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
}

interface MemberDetailModalProps {
    member: AdminMemberSummary;
    detail: AdminMemberLearningDetail | null;
    status: LoadState;
    error: string;
    onRetry: () => void;
    onClose: () => void;
}

function MemberDetailModal({ member, detail, status, error, onRetry, onClose }: MemberDetailModalProps) {
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const maxSectionSolvedCount = detail?.sectionSummaries.reduce(
        (maximum, section) => Math.max(maximum, section.solvedCount), 0
    ) ?? 0;

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButtonRef.current?.focus();
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [onClose]);

    return <div className='qb-member-modal-backdrop' data-testid='member-modal-backdrop' onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
    }}>
        <section className='qb-admin-card qb-member-modal' role='dialog' aria-modal='true' aria-labelledby='qb-member-detail-title' aria-describedby='qb-member-detail-description'>
            <header className='qb-member-modal-head'>
                <div><h2 id='qb-member-detail-title'>회원 상세 정보</h2><p id='qb-member-detail-description'>회원 기본 정보와 섹션별 학습 현황을 확인합니다.</p></div>
                <button ref={closeButtonRef} type='button' className='qb-member-icon-button' aria-label='회원 상세 정보 닫기' onClick={onClose}><MemberIcon name='close' /></button>
            </header>

            <section className='qb-member-profile' aria-label='기본 회원 정보'>
                <span className='qb-member-avatar'><MemberIcon name='user' size={34} /></span>
                <dl><div><dt>회원 이름</dt><dd>{detail?.userName ?? member.userName}</dd></div><div><dt>전화번호</dt><dd>{detail?.phoneNumber ?? member.phoneNumber}</dd></div></dl>
            </section>

            {status === 'loading' && <div className='qb-member-modal-state' role='status'>회원 학습 정보를 불러오고 있습니다…</div>}
            {status === 'error' && <div className='qb-member-modal-state is-error' role='alert'><p>{error}</p><button type='button' onClick={onRetry}>다시 시도</button></div>}
            {status === 'ready' && detail && <div className='qb-member-modal-content'>
                <section className='qb-member-learning-summary' aria-labelledby='qb-learning-summary-title'>
                    <h3 id='qb-learning-summary-title'>학습 현황 요약</h3>
                    <div className='qb-member-summary-grid'>
                        <article><span><MemberIcon name='clock' /></span><div><small>총 누적 풀이 시간</small><strong>{formatLearningTime(detail.totalSolveSeconds)}</strong></div></article>
                        <article><span><MemberIcon name='document' /></span><div><small>총 누적 풀이 횟수</small><strong>{detail.totalSolvedCount.toLocaleString()}회</strong></div></article>
                    </div>
                </section>

                <section className='qb-member-sections' aria-labelledby='qb-member-sections-title'>
                    <div><h3 id='qb-member-sections-title'>섹션별 학습 현황</h3><p>섹션별 누적 풀이 횟수와 정답률을 비교합니다.</p></div>
                    <div className='qb-admin-table-wrap'>
                        <table className='qb-admin-table'>
                            <thead><tr><th>섹션명</th><th>누적 풀이 횟수</th><th>정답률</th></tr></thead>
                            <tbody>{detail.sectionSummaries.length ? detail.sectionSummaries.map(section => <tr key={section.sectionId}>
                                <td>{section.sectionName}</td>
                                <td>
                                    <div className='qb-member-solved-count'>
                                        <span>{section.solvedCount.toLocaleString()}회</span>
                                        <span className='qb-member-solved-track' aria-hidden='true'>
                                            <span style={{ width: `${maxSectionSolvedCount ? (section.solvedCount / maxSectionSolvedCount) * 100 : 0}%` }} />
                                        </span>
                                    </div>
                                </td>
                                <td>
                                    <div className='qb-member-accuracy'>
                                        <span>{formatAccuracyRate(section.accuracyRate)}</span>
                                        <progress value={section.accuracyRate} max={100} aria-label={`${section.sectionName} 정답률`} />
                                        <small>{section.correctCount.toLocaleString()} / {section.solvedCount.toLocaleString()} 정답</small>
                                    </div>
                                </td>
                            </tr>) : <tr><td colSpan={3} className='qb-admin-empty'>학습 기록이 없습니다.</td></tr>}</tbody>
                        </table>
                    </div>
                </section>
            </div>}

            <footer className='qb-member-modal-footer'><button type='button' onClick={onClose}>닫기</button></footer>
        </section>
    </div>;
}

export default function MemberManagement({ dataSource = adminMemberDataSource }: { dataSource?: AdminMemberDataSource }) {
    const { accessToken } = useAuthStore();
    const [result, setResult] = useState<AdminMemberPage | null>(null);
    const [listStatus, setListStatus] = useState<LoadState>('loading');
    const [listError, setListError] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const [selectedMember, setSelectedMember] = useState<AdminMemberSummary | null>(null);
    const [detail, setDetail] = useState<AdminMemberLearningDetail | null>(null);
    const [detailStatus, setDetailStatus] = useState<LoadState>('loading');
    const [detailError, setDetailError] = useState('');
    const listSequence = useRef(0);
    const detailSequence = useRef(0);
    const opener = useRef<HTMLButtonElement | null>(null);

    const loadMembers = useCallback(async (keyword: string, targetPage: number) => {
        const sequence = ++listSequence.current;
        setListStatus('loading');
        setListError('');
        try {
            if (!accessToken) throw new Error('로그인 상태를 확인해주세요.');
            const response = await dataSource.getMembers(keyword, targetPage, accessToken);
            if (sequence === listSequence.current) { setResult(response); setListStatus('ready'); }
        } catch (reason) {
            if (sequence === listSequence.current) {
                setResult(null);
                setListError(reason instanceof Error ? reason.message : '회원 목록을 불러오지 못했습니다.');
                setListStatus('error');
            }
        }
    }, [accessToken, dataSource]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void loadMembers(query, page), query ? 300 : 0);
        return () => window.clearTimeout(timeout);
    }, [loadMembers, page, query]);

    useEffect(() => () => { listSequence.current += 1; detailSequence.current += 1; }, []);

    const loadDetail = useCallback(async (member: AdminMemberSummary) => {
        const sequence = ++detailSequence.current;
        setDetailStatus('loading');
        setDetailError('');
        setDetail(null);
        try {
            if (!accessToken) throw new Error('로그인 상태를 확인해주세요.');
            const response = await dataSource.getMemberDetail(member.userId, accessToken);
            if (sequence === detailSequence.current) { setDetail(response); setDetailStatus('ready'); }
        } catch (reason) {
            if (sequence === detailSequence.current) {
                setDetailError(reason instanceof Error ? reason.message : '회원 학습 정보를 불러오지 못했습니다.');
                setDetailStatus('error');
            }
        }
    }, [accessToken, dataSource]);

    const openDetail = (member: AdminMemberSummary, button: HTMLButtonElement) => {
        opener.current = button;
        setSelectedMember(member);
        void loadDetail(member);
    };

    const closeDetail = useCallback(() => {
        detailSequence.current += 1;
        setSelectedMember(null);
        setDetail(null);
        setDetailError('');
        requestAnimationFrame(() => opener.current?.focus());
    }, []);

    const users = result?.users ?? [];
    return <section className='qb-member-management'>
        <label className='qb-member-search'><MemberIcon name='search' /><span className='qb-admin-sr-only'>회원 검색</span><input type='search' value={query} maxLength={50} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder='회원 이름 또는 전화번호 검색' /></label>

        <section className='qb-admin-card qb-member-list-card' aria-busy={listStatus === 'loading'}>
            <div className='qb-member-list-head'><div><h2>회원 목록</h2><p className='qb-admin-caption'>{result ? `전체 ${result.totalElements.toLocaleString()}명` : '회원 목록을 준비하고 있습니다.'}</p></div><span className='qb-list-page-size'>20명씩 조회</span></div>
            {listStatus === 'loading' && <div className='qb-member-list-state' role='status'>회원 목록을 불러오고 있습니다…</div>}
            {listStatus === 'error' && <div className='qb-member-list-state is-error' role='alert'><p>{listError}</p><button type='button' onClick={() => void loadMembers(query, page)}>다시 시도</button></div>}
            {listStatus === 'ready' && <div className='qb-admin-table-wrap'><table className='qb-admin-table qb-member-table'>
                <thead><tr><th>회원 ID</th><th>회원 이름</th><th>전화번호</th><th>관리</th></tr></thead>
                <tbody>{users.length ? users.map(member => <tr key={member.userId}>
                    <td>{member.userId}</td><td>{member.userName}</td><td>{member.phoneNumber}</td><td><button type='button' className='qb-member-detail-button' onClick={event => openDetail(member, event.currentTarget)}>회원정보</button></td>
                </tr>) : <tr><td colSpan={4} className='qb-admin-empty'>{query.trim() ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}</td></tr>}</tbody>
            </table></div>}
            {listStatus === 'ready' && result && <nav className='qb-list-pagination' aria-label='회원 목록 페이지 이동'>
                <button type='button' className='qb-editor-secondary' disabled={result.page === 0} onClick={() => setPage(result.page - 1)}>이전</button>
                <span aria-live='polite'>전체 {result.totalElements.toLocaleString()}명 · {result.totalPages ? result.page + 1 : 0} / {result.totalPages} 페이지</span>
                <button type='button' className='qb-editor-secondary' disabled={result.last || result.page + 1 >= result.totalPages} onClick={() => setPage(result.page + 1)}>다음</button>
            </nav>}
        </section>

        {selectedMember && <MemberDetailModal member={selectedMember} detail={detail} status={detailStatus} error={detailError} onRetry={() => void loadDetail(selectedMember)} onClose={closeDetail} />}
    </section>;
}
