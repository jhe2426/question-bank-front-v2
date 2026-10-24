import React, { useEffect, useRef, useState } from 'react';
import { deleteAdminQuestionRequest, getAdminQuestionDetailRequest, putAdminQuestionRequest } from 'src/apis';
import { AdminQuestionDetail, PutAdminQuestionRequestDto } from 'src/apis/dto/response/admin/question-detail';
import { useAuthStore } from 'src/stores';
import { adminImageUrl } from './admin-image-url';
import { IMAGE_ACCEPT } from './question-draft';

type ImageChoice = { file: File | null; remove: boolean };
type Draft = {
    questionText: string; option1: string; option2: string; option3: string; option4: string;
    answer: string; difficulty: string; sectionId: string; shortExplanation: string;
    detailContent: string; pastExamRound: string; questionOrder: string; tags: string;
};
const fromDetail = (value: AdminQuestionDetail): Draft => ({
    questionText: value.questionText, option1: value.option1, option2: value.option2,
    option3: value.option3, option4: value.option4, answer: String(value.answer),
    difficulty: value.difficulty || '', sectionId: String(value.sectionId), shortExplanation: value.shortExplanation || '',
    detailContent: value.detailedExplanation?.content || '', pastExamRound: value.pastExamRound?.toString() || '',
    questionOrder: value.questionOrder?.toString() || '', tags: value.tags.join(',')
});
const positive = (value: string) => /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647;
const validImage = (file: File) => /\.(png|jpe?g|webp)$/i.test(file.name)
    && ['image/png', 'image/jpeg', 'image/webp', ''].includes(file.type) && file.size > 0 && file.size <= 10 * 1024 * 1024;

export interface QuestionEditorProps {
    questionId: number;
    pastExamRound: number | null;
    onClose: () => void;
    onSaved: () => Promise<void>;
    onDeleted: () => Promise<void>;
}

export default function QuestionEditor({ questionId, pastExamRound, onClose, onSaved, onDeleted }: QuestionEditorProps) {
    const { accessToken } = useAuthStore();
    const [detail, setDetail] = useState<AdminQuestionDetail | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [questionImage, setQuestionImage] = useState<ImageChoice>({ file: null, remove: false });
    const [explanationImage, setExplanationImage] = useState<ImageChoice>({ file: null, remove: false });
    const [questionPreview, setQuestionPreview] = useState('');
    const [explanationPreview, setExplanationPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
    const pending = useRef(false);
    const mounted = useRef(true);
    const requestSequence = useRef(0);
    useEffect(() => () => { mounted.current = false; requestSequence.current += 1; }, []);
    useEffect(() => {
        const url = questionImage.file ? URL.createObjectURL(questionImage.file) : '';
        setQuestionPreview(url);
        return () => { if (url) URL.revokeObjectURL(url); };
    }, [questionImage.file]);
    useEffect(() => {
        const url = explanationImage.file ? URL.createObjectURL(explanationImage.file) : '';
        setExplanationPreview(url);
        return () => { if (url) URL.revokeObjectURL(url); };
    }, [explanationImage.file]);
    useEffect(() => {
        const sequence = ++requestSequence.current;
        setLoading(true); setMessage(null); setDetail(null); setDraft(null);
        if (!accessToken) { setMessage({ tone: 'error', text: '로그인 상태를 확인해주세요.' }); setLoading(false); return; }
        getAdminQuestionDetailRequest(questionId, pastExamRound, accessToken).then(value => {
            if (mounted.current && requestSequence.current === sequence) { setDetail(value); setDraft(fromDetail(value)); }
        }).catch(reason => {
            if (mounted.current && requestSequence.current === sequence) setMessage({ tone: 'error', text: reason instanceof Error ? reason.message : '문제를 불러오지 못했습니다.' });
        }).finally(() => { if (mounted.current && requestSequence.current === sequence) setLoading(false); });
    }, [questionId, pastExamRound, accessToken]);

    const update = (key: keyof Draft, value: string) => setDraft(current => current ? { ...current, [key]: value } : current);
    const selectImage = (file: File | undefined, setter: React.Dispatch<React.SetStateAction<ImageChoice>>) => {
        if (!file) return;
        if (!validImage(file)) { setMessage({ tone: 'error', text: '이미지는 10MB 이하의 PNG, JPG, JPEG, WEBP 파일이어야 합니다.' }); return; }
        setter({ file, remove: false }); setMessage(null);
    };
    const buildRequest = (): PutAdminQuestionRequestDto => {
        if (!detail || !draft) throw new Error('문제 상세 정보를 먼저 불러와주세요.');
        for (const [label, text] of [['문제 지문', draft.questionText], ['선택지 1', draft.option1], ['선택지 2', draft.option2], ['선택지 3', draft.option3], ['선택지 4', draft.option4]]) {
            if (!text.trim() || text.length > 255) throw new Error(`${label}은(는) 1~255자로 입력해주세요.`);
        }
        if (!positive(draft.sectionId)) throw new Error('섹션 ID는 1 이상의 정수여야 합니다.');
        if (!/^[1-4]$/.test(draft.answer)) throw new Error('정답을 1~4번 중 선택해주세요.');
        if (detail.questionType === '모의고사' && !['상', '중', '하'].includes(draft.difficulty)) throw new Error('난이도를 선택해주세요.');
        if (draft.shortExplanation.length > 255) throw new Error('간단 해설은 255자 이하여야 합니다.');
        const tags = draft.tags.trim() ? draft.tags.split(',').map(value => value.trim()) : [];
        if (detail.questionType === '기출문제' && (!positive(draft.pastExamRound) || !positive(draft.questionOrder))) {
            throw new Error('기출 회차와 문제 순서를 1 이상의 정수로 입력해주세요.');
        }
        if (detail.questionType === '모의고사' && (tags.some(tag => !positive(tag)) || new Set(tags).size !== tags.length)) {
            throw new Error('태그는 중복 없는 양의 정수를 쉼표로 구분해 입력해주세요.');
        }
        const effectiveExplanationImage = !!explanationImage.file || (!explanationImage.remove && !!detail.detailedExplanation?.imageUrl);
        return {
            questionText: draft.questionText.trim(), option1: draft.option1.trim(), option2: draft.option2.trim(),
            option3: draft.option3.trim(), option4: draft.option4.trim(), answer: Number(draft.answer),
            difficulty: detail.questionType === '모의고사'
                ? draft.difficulty as '상' | '중' | '하'
                : ['상', '중', '하'].includes(draft.difficulty) ? draft.difficulty as '상' | '중' | '하' : null,
            sectionId: Number(draft.sectionId),
            shortExplanation: draft.shortExplanation.trim() || null,
            detailedExplanation: draft.detailContent.trim() || effectiveExplanationImage ? { content: draft.detailContent.trim() || null } : null,
            deleteQuestionImage: questionImage.remove, deleteExplanationImage: explanationImage.remove,
            pastExamRound: detail.questionType === '기출문제' ? Number(draft.pastExamRound) : null,
            questionOrder: detail.questionType === '기출문제' ? Number(draft.questionOrder) : null,
            tags: detail.questionType === '모의고사' ? tags.map(Number) : []
        };
    };
    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (pending.current) return;
        setMessage(null);
        let body: PutAdminQuestionRequestDto;
        try { body = buildRequest(); } catch (reason) {
            setMessage({ tone: 'error', text: reason instanceof Error ? reason.message : '입력값을 확인해주세요.' }); return;
        }
        if (!accessToken) { setMessage({ tone: 'error', text: '로그인 상태를 확인해주세요.' }); return; }
        pending.current = true; setBusy(true);
        try {
            await putAdminQuestionRequest(questionId, body, questionImage.file, explanationImage.file, accessToken);
            await onSaved();
        } catch (reason) {
            if (mounted.current) setMessage({ tone: 'error', text: reason instanceof Error ? reason.message : '문제 수정에 실패했습니다.' });
        } finally { pending.current = false; if (mounted.current) setBusy(false); }
    };
    const remove = async () => {
        if (pending.current || !accessToken) return;
        pending.current = true; setBusy(true); setMessage(null);
        try {
            await deleteAdminQuestionRequest(questionId, accessToken);
            if (mounted.current) { setConfirmDelete(false); await onDeleted(); }
        } catch (reason) {
            if (mounted.current) { setConfirmDelete(false); setMessage({ tone: 'error', text: reason instanceof Error ? reason.message : '문제 삭제에 실패했습니다.' }); }
        } finally { pending.current = false; if (mounted.current) setBusy(false); }
    };
    const questionImageSrc = questionPreview || (questionImage.remove ? undefined : adminImageUrl(detail?.imageUrl || null));
    const explanationImageSrc = explanationPreview || (explanationImage.remove ? undefined : adminImageUrl(detail?.detailedExplanation?.imageUrl || null));
    return <div className='qb-admin-modal-backdrop' role='presentation'>
        <section className='qb-admin-card qb-admin-editor-modal' role='dialog' aria-modal='true' aria-label={`${questionId}번 문제 상세 및 수정`}>
            <header className='qb-admin-editor-head'><div><h2>{questionId}번 문제</h2><p className='qb-admin-caption'>{detail?.questionType || '상세 조회 중'}</p></div><button type='button' className='qb-editor-secondary' onClick={onClose} disabled={busy}>닫기</button></header>
            {loading && <p role='status'>문제 상세를 불러오고 있습니다.</p>}
            {message && <p role={message.tone === 'error' ? 'alert' : 'status'} className={`qb-editor-result ${message.tone}`}>{message.text}</p>}
            {detail && draft && <form onSubmit={save} className='qb-admin-detail-form'>
                <fieldset disabled={busy}>
                    <div className={`qb-admin-detail-grid${detail.questionType === '기출문제' ? ' qb-admin-past-metadata' : ''}`}>
                        <label>문제 유형<input value={detail.questionType} readOnly /></label>
                        <label>섹션 ID<input inputMode='numeric' value={draft.sectionId} onChange={e => update('sectionId', e.target.value)} /></label>
                        {detail.questionType === '모의고사' && <label>난이도<select value={draft.difficulty} onChange={e => update('difficulty', e.target.value)}>
                            {!['상', '중', '하'].includes(draft.difficulty) && <option value=''>난이도 선택</option>}
                            {['상', '중', '하'].map(value => <option key={value}>{value}</option>)}
                        </select></label>}
                    </div>
                    <label>문제 지문<textarea rows={4} value={draft.questionText} onChange={e => update('questionText', e.target.value)} /></label>
                    <ImageControl label='문제 이미지' src={questionImageSrc} choice={questionImage} original={!!detail.imageUrl} onSelect={file => selectImage(file, setQuestionImage)} onRemove={() => setQuestionImage({ file: null, remove: true })} onRestore={() => setQuestionImage({ file: null, remove: false })} />
                    <div className='qb-admin-detail-grid qb-admin-detail-options'>{(['option1', 'option2', 'option3', 'option4'] as const).map((key, index) => <label key={key}>선택지 {index + 1}<input value={draft[key]} onChange={e => update(key, e.target.value)} /></label>)}</div>
                    <label>정답 번호<select value={draft.answer} onChange={e => update('answer', e.target.value)}>{[1, 2, 3, 4].map(number => <option key={number} value={number}>{number}번 — {draft[`option${number}` as keyof Draft]}</option>)}</select></label>
                    {detail.questionType === '모의고사' && <label>간단 해설<textarea rows={2} value={draft.shortExplanation} onChange={e => update('shortExplanation', e.target.value)} /></label>}
                    <label>상세 해설<textarea rows={3} value={draft.detailContent} onChange={e => update('detailContent', e.target.value)} /></label>
                    <ImageControl label='상세 해설 이미지' src={explanationImageSrc} choice={explanationImage} original={!!detail.detailedExplanation?.imageUrl} onSelect={file => selectImage(file, setExplanationImage)} onRemove={() => setExplanationImage({ file: null, remove: true })} onRestore={() => setExplanationImage({ file: null, remove: false })} />
                    {detail.questionType === '기출문제' ? <div className='qb-admin-detail-grid'><label>기출 회차<input inputMode='numeric' value={draft.pastExamRound} onChange={e => update('pastExamRound', e.target.value)} /></label><label>문제 순서<input inputMode='numeric' value={draft.questionOrder} onChange={e => update('questionOrder', e.target.value)} /></label></div>
                        : <label>모의고사 태그<input value={draft.tags} onChange={e => update('tags', e.target.value)} placeholder='35,36,37' /></label>}
                    <div className='qb-admin-editor-actions'><button type='button' className='qb-admin-delete' onClick={() => setConfirmDelete(true)}>삭제</button><button type='submit' className='qb-admin-submit'>{busy ? '저장 중…' : '변경 사항 저장'}</button></div>
                </fieldset>
            </form>}
            {confirmDelete && <div className='qb-admin-confirm-overlay'><div className='qb-admin-card qb-admin-confirm' role='alertdialog' aria-modal='true' aria-label='문제 삭제 확인' aria-describedby='qb-admin-delete-description'><p id='qb-admin-delete-description'>선택한 문제를 삭제하시겠습니까? 삭제된 문제는 복구할 수 없습니다.</p><button type='button' className='qb-editor-secondary' disabled={busy} onClick={() => setConfirmDelete(false)}>취소</button><button type='button' className='qb-admin-delete' disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중…' : '삭제 확인'}</button></div></div>}
        </section>
    </div>;
}

function ImageControl({ label, src, choice, original, onSelect, onRemove, onRestore }: {
    label: string; src?: string; choice: ImageChoice; original: boolean;
    onSelect: (file?: File) => void; onRemove: () => void; onRestore: () => void;
}) {
    return <div className='qb-admin-image-control'><strong>{label}</strong>
        {src ? <img src={src} alt={label} /> : <p className='qb-admin-caption'>이미지 없음</p>}
        <label>{label} 새 이미지 선택<input type='file' accept={IMAGE_ACCEPT} onChange={e => { onSelect(e.target.files?.[0]); e.target.value = ''; }} /></label>
        {src && <button type='button' className='qb-editor-secondary' onClick={onRemove}>이미지 삭제</button>}
        {choice.remove && original && <button type='button' className='qb-editor-secondary' onClick={onRestore}>기존 이미지 유지</button>}
        {choice.file && <p className='qb-admin-caption'>선택한 파일: {choice.file.name}</p>}
    </div>;
}
