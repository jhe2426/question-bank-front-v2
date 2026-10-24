import React, { useEffect, useRef, useState } from 'react';
import { deleteAdminQuestionRequest, getAdminQuestionsRequest, getPastExamRoundListRequest } from 'src/apis';
import { AdminQuestionPage, QuestionListFilter } from 'src/apis/dto/response/admin/question-list';
import { useAuthStore } from 'src/stores';
import QuestionEditor from './QuestionEditor';

// component: 등록된 문제 조건 조회 및 서버 페이지 이동 //
export default function QuestionList() {
    const { accessToken } = useAuthStore();
    const [type, setType] = useState<'기출문제' | '모의고사'>('기출문제');
    const [round, setRound] = useState('');
    const [rounds, setRounds] = useState<number[]>([]);
    const [roundsLoading, setRoundsLoading] = useState(true);
    const [roundsError, setRoundsError] = useState('');
    const [roundsRetry, setRoundsRetry] = useState(0);
    const [difficulty, setDifficulty] = useState<'상' | '중' | '하'>('중');
    const [appliedFilter, setAppliedFilter] = useState<QuestionListFilter | null>(null);
    const [result, setResult] = useState<AdminQuestionPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [editingTarget, setEditingTarget] = useState<{ questionId: number; pastExamRound: number | null } | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [notice, setNotice] = useState('');
    const deletePending = useRef(false);
    const [error, setError] = useState('');
    const sequence = useRef(0);
    const pending = useRef(false);
    useEffect(() => () => { sequence.current += 1; }, []);

    // effect: 서버에 존재하는 회차만 선택하도록 기존 회차 조회 API 재사용 //
    useEffect(() => {
        let active = true;
        setRoundsLoading(true); setRoundsError(''); setRounds([]); setRound('');
        const fetchRounds = async () => {
            try {
                if (!accessToken) throw new Error('로그인 상태를 확인해주세요.');
                const response = await getPastExamRoundListRequest(accessToken);
                if (!response || response.code !== 'SU') throw new Error(response?.message || '기출 회차를 불러오지 못했습니다.');
                if (!('pastExamRounds' in response) || !Array.isArray(response.pastExamRounds)
                    || !response.pastExamRounds.every(item => Number.isInteger(item.pastExamRound) && item.pastExamRound > 0)) {
                    throw new Error('기출 회차 응답 형식을 확인할 수 없습니다.');
                }
                if (active) setRounds(Array.from(new Set(response.pastExamRounds.map(item => item.pastExamRound))));
            } catch (reason) {
                if (active) setRoundsError(reason instanceof Error ? reason.message : '기출 회차를 불러오지 못했습니다.');
            } finally { if (active) setRoundsLoading(false); }
        };
        void fetchRounds();
        return () => { active = false; };
    }, [accessToken, roundsRetry]);

    const clearResults = () => { setResult(null); setAppliedFilter(null); setError(''); setNotice(''); setEditingTarget(null); setDeleteId(null); };
    const load = async (filter: QuestionListFilter, page: number) => {
        if (pending.current) return;
        if (!accessToken) { setError('로그인 상태를 확인해주세요.'); return; }
        pending.current = true;
        const request = ++sequence.current;
        setLoading(true); setError(''); setResult(null); setAppliedFilter(filter);
        try {
            const data = await getAdminQuestionsRequest(filter, page, accessToken);
            if (request === sequence.current) setResult(data);
            return true;
        } catch (reason) {
            if (request === sequence.current) setError(reason instanceof Error ? reason.message : '문제 목록 조회에 실패했습니다.');
            return false;
        } finally {
            if (request === sequence.current) { pending.current = false; setLoading(false); }
        }
    };
    const refresh = async (afterDelete = false) => {
        if (!appliedFilter || !result) return;
        const nextPage = afterDelete && result.questions.length === 1 && result.page > 0 ? result.page - 1 : result.page;
        if (!await load(appliedFilter, nextPage)) throw new Error('문제 목록을 다시 불러오지 못했습니다.');
    };
    const remove = async () => {
        if (deleteId === null || deletePending.current || !accessToken) return;
        deletePending.current = true; setDeleting(true); setError(''); setNotice('');
        try {
            await deleteAdminQuestionRequest(deleteId, accessToken);
            setDeleteId(null); setEditingTarget(null);
            try { await refresh(true); setNotice('문제를 삭제했습니다.'); }
            catch { setNotice('문제를 삭제했습니다. 목록을 다시 조회해주세요.'); }
        } catch (reason) {
            setDeleteId(null);
            setError(reason instanceof Error ? reason.message : '문제 삭제에 실패했습니다.');
        } finally { deletePending.current = false; setDeleting(false); }
    };
    const search = (event: React.FormEvent) => {
        event.preventDefault();
        if (type === '기출문제' && (roundsLoading || !round || !rounds.includes(Number(round)))) {
            setError('등록된 기출 회차를 선택해주세요.'); return;
        }
        void load(type === '기출문제' ? { questionType: type, pastExamRound: Number(round) } : { questionType: type, difficulty }, 0);
    };
    return <div className='qb-question-list' aria-busy={loading}>
        <section className='qb-admin-card qb-list-condition-card' aria-labelledby='qb-list-search-title'>
        <h2 id='qb-list-search-title'>등록된 문제 조회</h2>
        <form onSubmit={search} className='qb-list-filters'>
            <fieldset disabled={loading}>
                <legend>문제 유형</legend>
                {(['기출문제', '모의고사'] as const).map(value => <label key={value}><input type='radio' name='list-question-type' checked={type === value} onChange={() => { setType(value); clearResults(); }} />{value}</label>)}
            </fieldset>
            {type === '기출문제' ? <label>기출 회차<select value={round} disabled={loading || roundsLoading || !rounds.length} onChange={event => { setRound(event.target.value); clearResults(); }}>
                <option value=''>{roundsLoading ? '회차 불러오는 중…' : '회차 선택'}</option>
                {rounds.map(value => <option key={value} value={value}>{value}회</option>)}
            </select></label>
                : <label>난이도<select value={difficulty} disabled={loading} onChange={event => { setDifficulty(event.target.value as typeof difficulty); clearResults(); }}>{['상', '중', '하'].map(value => <option key={value}>{value}</option>)}</select></label>}
            <button type='submit' className='qb-admin-submit' disabled={loading || (type === '기출문제' && (roundsLoading || !rounds.length))}>{loading ? '조회 중…' : '조회'}</button>
        </form>
        {type === '기출문제' && roundsError && <div className='qb-list-round-error'><p role='alert'>{roundsError}</p><button type='button' className='qb-editor-secondary' disabled={roundsLoading} onClick={() => setRoundsRetry(value => value + 1)}>회차 다시 불러오기</button></div>}
        {type === '기출문제' && !roundsLoading && !roundsError && !rounds.length && <p role='status' className='qb-admin-caption'>등록된 기출 회차가 없습니다.</p>}
        </section>
        <section className='qb-admin-card qb-list-results' aria-labelledby='qb-list-results-title'>
        <header className='qb-list-results-heading'><div><h2 id='qb-list-results-title'>문제 목록</h2><p className='qb-admin-caption'>{result ? `전체 ${result.totalElements}문제` : '조건에 맞는 등록된 문제를 확인하세요.'}</p></div><span className='qb-list-page-size'>20개씩 조회</span></header>
        {error && <p role='alert' className='qb-editor-result error'>{error}</p>}
        {notice && <p role='status' className='qb-editor-result success'>{notice}</p>}
        <div className='qb-admin-table-wrap'><table className='qb-admin-table'>
            <caption className='qb-admin-sr-only'>등록된 문제 목록</caption>
            <thead><tr><th scope='col'>문제 ID</th>{type === '기출문제' && <th scope='col'>문제 번호</th>}<th scope='col' className='qb-list-text-column'>문제 지문</th><th scope='col'>난이도</th><th scope='col'>이미지</th><th scope='col'>관리</th></tr></thead>
            <tbody>{result?.questions.map(question => <tr key={question.questionId}>
                <td>{question.questionId}</td>{type === '기출문제' && <td>{question.questionOrder ?? '—'}</td>}
                <td className='qb-list-text-cell'><span className='qb-list-question-text' title={question.questionText}>{question.questionText}</span></td><td>{question.difficulty || '—'}</td>
                <td>{question.imageUrl ? <span className='qb-list-image-badge'><svg aria-hidden='true' viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' strokeWidth='1.7'><rect x='3' y='3' width='18' height='18' rx='3' /><circle cx='8' cy='8' r='1.5' /><path d='m3 17 5-5 4 4 4-6 5 7' /></svg>있음</span> : <span className='qb-list-no-image'>없음</span>}</td><td><div className='qb-list-row-actions'><button type='button' className='qb-editor-secondary' onClick={() => {
                    if (question.questionType === '기출문제' && question.pastExamRound === null) {
                        setError('기출 회차 정보가 없어 상세 문제를 조회할 수 없습니다. 목록을 다시 조회해주세요.');
                        return;
                    }
                    setEditingTarget({
                        questionId: question.questionId,
                        pastExamRound: question.questionType === '기출문제' ? question.pastExamRound : null
                    });
                    setNotice(''); setError('');
                }}>수정</button><button type='button' className='qb-admin-delete' onClick={() => { setDeleteId(question.questionId); setNotice(''); }}>삭제</button></div></td>
            </tr>)}{!result?.questions.length && <tr><td className='qb-admin-empty' colSpan={type === '기출문제' ? 6 : 5}>
                {loading ? '문제 목록을 불러오고 있습니다.' : result ? '등록된 문제가 없습니다.' : error ? '조회 결과를 표시할 수 없습니다.' : '조회 조건을 선택한 후 조회 버튼을 눌러주세요.'}
            </td></tr>}</tbody>
        </table></div>
        {result && <nav className='qb-list-pagination' aria-label='문제 목록 페이지 이동'>
            <button type='button' className='qb-editor-secondary' disabled={loading || result.page === 0} onClick={() => appliedFilter && void load(appliedFilter, result.page - 1)}>이전</button>
            <span aria-live='polite'>전체 {result.totalElements}문제 · {result.totalPages ? result.page + 1 : 0} / {result.totalPages} 페이지</span>
            <button type='button' className='qb-editor-secondary' disabled={loading || result.last || result.page + 1 >= result.totalPages} onClick={() => appliedFilter && void load(appliedFilter, result.page + 1)}>다음</button>
        </nav>}
        </section>
        {editingTarget !== null && <QuestionEditor key={`${editingTarget.questionId}-${editingTarget.pastExamRound ?? 'mock'}`} questionId={editingTarget.questionId} pastExamRound={editingTarget.pastExamRound} onClose={() => setEditingTarget(null)} onSaved={async () => {
            setEditingTarget(null);
            try { await refresh(); setNotice('문제를 수정했습니다.'); }
            catch { setNotice('문제를 수정했습니다. 목록을 다시 조회해주세요.'); }
        }} onDeleted={async () => { setEditingTarget(null); try { await refresh(true); setNotice('문제를 삭제했습니다.'); } catch { setNotice('문제를 삭제했습니다. 목록을 다시 조회해주세요.'); } }} />}
        {deleteId !== null && <div className='qb-admin-modal-backdrop'><div className='qb-admin-card qb-admin-confirm' role='alertdialog' aria-modal='true' aria-label='문제 삭제 확인' aria-describedby='qb-list-delete-description'><p id='qb-list-delete-description'>선택한 문제를 삭제하시겠습니까? 삭제된 문제는 복구할 수 없습니다.</p><div><button type='button' className='qb-editor-secondary' disabled={deleting} onClick={() => setDeleteId(null)}>취소</button><button type='button' className='qb-admin-delete' disabled={deleting} onClick={() => void remove()}>{deleting ? '삭제 중…' : '삭제 확인'}</button></div></div></div>}
    </div>;
}
