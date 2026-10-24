import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminMemberDataSource } from './admin-member-data';
import { AdminMemberDataSource, AdminMemberLearningDetail, AdminMemberSummary } from './admin-member.types';

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

export function formatTotalLearningTime(totalMinutes: number) {
    const safeMinutes = Math.max(0, Math.floor(totalMinutes));
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    if (!hours) return `${minutes}분`;
    return minutes ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

interface MemberDetailModalProps {
    member: AdminMemberSummary;
    detail: AdminMemberLearningDetail | null;
    status: LoadState;
    isFixture: boolean;
    onRetry: () => void;
    onClose: () => void;
}

function MemberDetailModal({ member, detail, status, isFixture, onRetry, onClose }: MemberDetailModalProps) {
    const closeButtonRef = useRef<HTMLButtonElement>(null);

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

            {isFixture && <p className='qb-member-fixture-notice' role='note'>백엔드 API 연결 전 화면 확인을 위한 테스트 데이터입니다.</p>}

            <section className='qb-member-profile' aria-label='기본 회원 정보'>
                <span className='qb-member-avatar'><MemberIcon name='user' size={34} /></span>
                <dl><div><dt>회원 이름</dt><dd>{detail?.name ?? member.name}</dd></div><div><dt>전화번호</dt><dd>{detail?.phoneNumber ?? member.phoneNumber}</dd></div></dl>
                {isFixture && <span className='qb-member-fixture-badge'>테스트 데이터</span>}
            </section>

            {status === 'loading' && <div className='qb-member-modal-state' role='status'>회원 학습 정보를 불러오고 있습니다…</div>}
            {status === 'error' && <div className='qb-member-modal-state is-error' role='alert'><p>회원 학습 정보를 불러오지 못했습니다.</p><button type='button' onClick={onRetry}>다시 시도</button></div>}
            {status === 'ready' && detail && <div className='qb-member-modal-content'>
                <section className='qb-member-learning-summary' aria-labelledby='qb-learning-summary-title'>
                    <h3 id='qb-learning-summary-title'>학습 현황 요약</h3>
                    <div className='qb-member-summary-grid'>
                        <article><span><MemberIcon name='clock' /></span><div><small>총 문제 풀이 시간</small><strong>{formatTotalLearningTime(detail.totalSolveMinutes)}</strong></div></article>
                        <article><span><MemberIcon name='document' /></span><div><small>총 풀이 문항 수</small><strong>{detail.totalSolvedQuestionCount.toLocaleString()}문제</strong></div></article>
                    </div>
                </section>

                <section className='qb-member-sections' aria-labelledby='qb-member-sections-title'>
                    <div><h3 id='qb-member-sections-title'>섹션별 학습 현황</h3><p>섹션별 풀이 문항 수와 누적 풀이 시간을 표시합니다.</p></div>
                    <div className='qb-admin-table-wrap'>
                        <table className='qb-admin-table'>
                            <thead><tr><th>섹션명</th><th>풀이 문항 수</th><th>누적 풀이 시간</th></tr></thead>
                            <tbody>{detail.sections.length ? detail.sections.map(section => <tr key={section.sectionId}>
                                <td>{section.sectionName}</td><td>{section.solvedQuestionCount.toLocaleString()}문제</td><td>{section.totalSolveMinutes.toLocaleString()}분</td>
                            </tr>) : <tr><td colSpan={3} className='qb-admin-empty'>학습 기록이 없습니다.</td></tr>}</tbody>
                        </table>
                    </div>
                </section>
            </div>}
            {status === 'ready' && !detail && <div className='qb-member-modal-state'>회원 상세 정보가 없습니다.</div>}

            <footer className='qb-member-modal-footer'><button type='button' onClick={onClose}>닫기</button></footer>
        </section>
    </div>;
}

export default function MemberManagement({ dataSource = adminMemberDataSource }: { dataSource?: AdminMemberDataSource }) {
    const [members, setMembers] = useState<AdminMemberSummary[]>([]);
    const [listStatus, setListStatus] = useState<LoadState>('loading');
    const [query, setQuery] = useState('');
    const [selectedMember, setSelectedMember] = useState<AdminMemberSummary | null>(null);
    const [detail, setDetail] = useState<AdminMemberLearningDetail | null>(null);
    const [detailStatus, setDetailStatus] = useState<LoadState>('loading');
    const listSequence = useRef(0);
    const detailSequence = useRef(0);
    const opener = useRef<HTMLButtonElement | null>(null);

    const loadMembers = useCallback(async () => {
        const sequence = ++listSequence.current;
        setListStatus('loading');
        try {
            const response = await dataSource.getMembers();
            if (sequence === listSequence.current) { setMembers(response); setListStatus('ready'); }
        } catch {
            if (sequence === listSequence.current) setListStatus('error');
        }
    }, [dataSource]);

    useEffect(() => {
        void loadMembers();
        return () => { listSequence.current += 1; detailSequence.current += 1; };
    }, [loadMembers]);

    const loadDetail = useCallback(async (member: AdminMemberSummary) => {
        const sequence = ++detailSequence.current;
        setDetailStatus('loading');
        setDetail(null);
        try {
            const response = await dataSource.getMemberDetail(member.memberId);
            if (sequence === detailSequence.current) { setDetail(response); setDetailStatus('ready'); }
        } catch {
            if (sequence === detailSequence.current) setDetailStatus('error');
        }
    }, [dataSource]);

    const openDetail = (member: AdminMemberSummary, button: HTMLButtonElement) => {
        opener.current = button;
        setSelectedMember(member);
        void loadDetail(member);
    };

    const closeDetail = useCallback(() => {
        detailSequence.current += 1;
        setSelectedMember(null);
        setDetail(null);
        requestAnimationFrame(() => opener.current?.focus());
    }, []);

    const filteredMembers = useMemo(() => {
        const normalized = query.replace(/[\s-]/g, '').toLowerCase();
        if (!normalized) return members;
        return members.filter(member => `${member.name}${member.phoneNumber}`.replace(/[\s-]/g, '').toLowerCase().includes(normalized));
    }, [members, query]);

    return <section className='qb-member-management'>
        {dataSource.isFixture && <p className='qb-member-fixture-notice' role='note'>현재 회원 목록과 학습 현황은 UI 확인용 테스트 데이터이며 실제 회원 기록이 아닙니다.</p>}
        <label className='qb-member-search'><MemberIcon name='search' /><span className='qb-admin-sr-only'>회원 검색</span><input type='search' value={query} onChange={event => setQuery(event.target.value)} placeholder='테스트 회원 이름 또는 전화번호 검색' /></label>

        <section className='qb-admin-card qb-member-list-card' aria-busy={listStatus === 'loading'}>
            <div className='qb-member-list-head'><div><h2>회원 목록</h2><p className='qb-admin-caption'>{listStatus === 'ready' ? `전체 ${members.length}명` : '회원 목록을 준비하고 있습니다.'}</p></div></div>
            {listStatus === 'loading' && <div className='qb-member-list-state' role='status'>회원 목록을 불러오고 있습니다…</div>}
            {listStatus === 'error' && <div className='qb-member-list-state is-error' role='alert'><p>회원 목록을 불러오지 못했습니다.</p><button type='button' onClick={() => void loadMembers()}>다시 시도</button></div>}
            {listStatus === 'ready' && <div className='qb-admin-table-wrap'><table className='qb-admin-table qb-member-table'>
                <thead><tr><th>회원 이름</th><th>전화번호</th><th>관리</th></tr></thead>
                <tbody>{filteredMembers.length ? filteredMembers.map(member => <tr key={member.memberId}>
                    <td>{member.name}</td><td>{member.phoneNumber}</td><td><button type='button' className='qb-member-detail-button' onClick={event => openDetail(member, event.currentTarget)}>회원정보</button></td>
                </tr>) : <tr><td colSpan={3} className='qb-admin-empty'>{members.length ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}</td></tr>}</tbody>
            </table></div>}
        </section>

        {selectedMember && <MemberDetailModal member={selectedMember} detail={detail} status={detailStatus} isFixture={dataSource.isFixture} onRetry={() => void loadDetail(selectedMember)} onClose={closeDetail} />}
    </section>;
}
