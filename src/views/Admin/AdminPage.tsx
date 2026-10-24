import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { approvalCodeRequest, postAdminQuestionsRequest } from 'src/apis';
import { useAuthStore } from 'src/stores';
import { ADMIN_UPLOAD_ABSOLUTE_PATH, ADMIN_QUESTIONS_ABSOLUTE_PATH, ADMIN_APPROVALS_ABSOLUTE_PATH, ADMIN_MEMBERS_ABSOLUTE_PATH } from 'src/constants';
import QuestionCard from './QuestionCard';
import QuestionList from './QuestionList';
import MemberManagement from './MemberManagement';
import { buildQuestionsRequest, connectQuestionImages, IMAGE_ACCEPT, parseQuestionFile, QuestionDraft, SelectedImage, validateImageFiles, validateQuestions } from './question-draft';
import 'katex/dist/katex.min.css';
import './style.css';

// component: 관리자 화면 공통 아이콘 //
function AdminIcon({ name, size = 20, strokeWidth = 1.8, ...props }: React.SVGProps<SVGSVGElement> & { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>,
    search: <><circle cx="10.5" cy="10.5" r="7.5" /><path d="m16 16 5 5" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="8" cy="7" r="3" fill="white" /><circle cx="16" cy="17" r="3" fill="white" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    notice: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3h.01" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}

// component: 승인번호 발송 화면 //
function ApprovalPanel() {
    const { accessToken } = useAuthStore();
    const [recipient, setRecipient] = useState('');
    const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
    const [isSending, setIsSending] = useState(false);
    const sendingRef = useRef(false);

    // event handler: 전화번호 형식 확인 후 실제 승인번호 발송 API 요청 //
    const sendApprovalCode = async (event: React.FormEvent) => {
        event.preventDefault();
        if (sendingRef.current) return;
        setMessage(null);
        const phoneNumber = recipient.replace(/[\s-]/g, '');
        if (!/^[0-9]{11}$/.test(phoneNumber)) {
            setMessage({ tone: 'error', text: '전화번호를 숫자 11자리로 입력해주세요.' });
            return;
        }
        if (!accessToken) {
            setMessage({ tone: 'error', text: '로그인 상태를 확인해주세요.' });
            return;
        }
        sendingRef.current = true;
        setIsSending(true);
        try {
            const response = await approvalCodeRequest({ phoneNumber }, accessToken);
            if (response?.code === 'SU') {
                setMessage({ tone: 'success', text: `${phoneNumber}로 승인번호를 발송했습니다.` });
            } else {
                setMessage({ tone: 'error', text: response?.message || '발송 결과를 확인하지 못했습니다. 연결 상태를 확인해주세요.' });
            }
        } catch {
            setMessage({ tone: 'error', text: '발송 결과를 확인하지 못했습니다. 연결 상태를 확인해주세요.' });
        } finally {
            sendingRef.current = false;
            setIsSending(false);
        }
    };

    return <section className='qb-admin-card qb-admin-approval-card'>
        <h2>승인번호 관리</h2>
        <p className='qb-admin-caption'>입력한 전화번호로 승인번호를 문자 발송합니다.</p>
        <form className='qb-admin-approval-form' onSubmit={sendApprovalCode} aria-busy={isSending}>
            <label htmlFor='qb-recipient'>수신 전화번호</label>
            <input id='qb-recipient' type='tel' autoComplete='tel' value={recipient} disabled={isSending} onChange={event => { setRecipient(event.target.value); setMessage(null); }} placeholder='01012345678' />
            <button type='submit' disabled={isSending}>{isSending ? '발송 중…' : '승인번호 발송'}</button>
        </form>
        {message && <p role={message.tone === 'error' ? 'alert' : 'status'} className={`qb-editor-result ${message.tone}`}>{message.text}</p>}
    </section>;
}

// component: 관리자 일괄 등록 화면 — 편집 상태를 최종 등록 시에만 전송 //
export default function AdminPage() {
    // state: 수정 중인 문제, 이미지 파일/미리보기 URL, 요청 상태 //
    const { pathname } = useLocation();
    const { accessToken } = useAuthStore();
    const [questions, setQuestions] = useState<QuestionDraft[]>([]);
    const [images, setImages] = useState<SelectedImage[]>([]);
    const [jsonFilename, setJsonFilename] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [hasValidated, setHasValidated] = useState(false);
    const [filter, setFilter] = useState('전체');
    const [dragging, setDragging] = useState<'json' | 'images' | null>(null);
    const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
    const imageRef = useRef<SelectedImage[]>([]);
    const jsonInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const requestRef = useRef(false);
    const readSequenceRef = useRef(0);
    const errorRef = useRef<HTMLDivElement>(null);

    const isApprovalPage = pathname === ADMIN_APPROVALS_ABSOLUTE_PATH;
    const isListPage = pathname === ADMIN_QUESTIONS_ABSOLUTE_PATH;
    const isMemberPage = pathname === ADMIN_MEMBERS_ABSOLUTE_PATH;
    const isProblemPage = !isApprovalPage && !isMemberPage;
    const title = isApprovalPage ? '승인번호 관리' : isMemberPage ? '회원 목록' : isListPage ? '문제 목록' : '문제 업로드';
    const locked = isSubmitting || isRegistered || isParsing;
    const issues = hasValidated ? validateQuestions(questions, images) : [];

    // effect: 화면을 떠날 때 남아 있는 Object URL 및 JSON 읽기 작업 정리 //
    useEffect(() => () => {
        readSequenceRef.current += 1;
        imageRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl));
    }, []);

    const setSelectedImages = (next: SelectedImage[]) => {
        imageRef.current = next;
        setImages(next);
    };

    const reset = () => {
        if (requestRef.current) return;
        readSequenceRef.current += 1;
        imageRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl));
        setSelectedImages([]);
        setQuestions([]);
        setJsonFilename('');
        setHasValidated(false);
        setIsRegistered(false);
        setIsParsing(false);
        setMessage(null);
        setFilter('전체');
    };

    // event handler: JSON 선택 시 파싱만 수행하며 저장 API를 호출하지 않음 //
    const selectJson = async (file?: File) => {
        if (!file || requestRef.current || isRegistered) return;
        const sequence = ++readSequenceRef.current;
        setMessage(null);
        if (!/\.json$/i.test(file.name)) {
            setIsParsing(false);
            setMessage({ tone: 'error', text: '.json 파일을 선택해주세요.' });
            return;
        }
        setIsParsing(true);
        try {
            const parsedQuestions = parseQuestionFile(await file.text());
            if (sequence !== readSequenceRef.current) return;
            if (questions.length && !window.confirm('현재 편집 중인 문제를 새 JSON의 문제로 바꿀까요?')) return;
            setQuestions(connectQuestionImages(parsedQuestions, imageRef.current));
            setJsonFilename(file.name);
            setHasValidated(false);
            setFilter('전체');
        } catch (error) {
            if (sequence === readSequenceRef.current) setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'JSON 파일을 읽지 못했습니다.' });
        } finally {
            if (sequence === readSequenceRef.current) setIsParsing(false);
        }
    };

    const addImages = (files: File[]) => {
        if (isSubmitting || isRegistered || requestRef.current || !files.length) return;
        const error = validateImageFiles(files, imageRef.current);
        if (error) { setMessage({ tone: 'error', text: error }); return; }
        const additions = files.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
        const nextImages = [...imageRef.current, ...additions];
        setSelectedImages(nextImages);
        setQuestions(current => connectQuestionImages(current, nextImages));
        setMessage(null);
    };

    // event handler: 참조 중인 이미지 삭제 시 확인 후 문제와 해설 참조도 함께 해제 //
    const deleteImage = (filename: string) => {
        if (isSubmitting || isRegistered || requestRef.current) return;
        const references = questions.flatMap((question, index) => question.imageFileName === filename || question.detailedExplanation?.imageFileName === filename ? [index + 1] : []);
        if (references.length && !window.confirm(`${references.join(', ')}번 문제에서 사용 중인 ${filename}을(를) 삭제하고 이미지 연결도 해제할까요?`)) return;
        const removed = imageRef.current.find(image => image.file.name === filename);
        if (removed) URL.revokeObjectURL(removed.previewUrl);
        setSelectedImages(imageRef.current.filter(image => image.file.name !== filename));
        setQuestions(current => current.map(question => ({
            ...question,
            imageFileName: question.imageFileName === filename ? '' : question.imageFileName,
            detailedExplanation: question.detailedExplanation ? {
                ...question.detailedExplanation,
                imageFileName: question.detailedExplanation.imageFileName === filename ? '' : question.detailedExplanation.imageFileName
            } : null
        })));
    };

    const handleDrop = (event: React.DragEvent, kind: 'json' | 'images') => {
        event.preventDefault();
        setDragging(null);
        if (isSubmitting || isRegistered) return;
        const files = Array.from(event.dataTransfer.files);
        if (kind === 'json') {
            if (files.length !== 1) { setMessage({ tone: 'error', text: 'JSON 파일은 한 개만 선택해주세요.' }); return; }
            void selectJson(files[0]);
        } else addImages(files);
    };

    const changeQuestion = (key: string, update: Partial<QuestionDraft>) => {
        if (locked || requestRef.current) return;
        setQuestions(current => current.map(question => question.key === key ? { ...question, ...update } : question));
        setMessage(null);
    };

    // event handler: 검증 완료 후 최신 상태에서 JSON을 다시 만들고 multipart 요청 //
    const submitQuestions = async () => {
        if (requestRef.current || locked) return;
        setMessage(null);
        setHasValidated(true);
        if (!questions.length) { setMessage({ tone: 'error', text: '등록할 JSON 파일을 먼저 선택해주세요.' }); return; }
        if (validateQuestions(questions, imageRef.current).length) {
            requestAnimationFrame(() => errorRef.current?.focus());
            return;
        }
        if (!accessToken) { setMessage({ tone: 'error', text: '로그인 상태를 확인해주세요.' }); return; }
        requestRef.current = true;
        setIsSubmitting(true);
        try {
            const response = await postAdminQuestionsRequest(buildQuestionsRequest(questions), imageRef.current.map(image => image.file), accessToken);
            if (response?.code === 'SU') {
                setIsRegistered(true);
                setMessage({ tone: 'success', text: '문제 등록이 완료되었습니다.' });
            } else {
                setMessage({ tone: 'error', text: response?.message || '서버 응답을 확인하지 못했습니다. 입력한 문제와 이미지는 유지됩니다.' });
            }
        } catch {
            setMessage({ tone: 'error', text: '문제 등록 요청에 실패했습니다. 입력한 문제와 이미지는 유지됩니다.' });
        } finally {
            requestRef.current = false;
            setIsSubmitting(false);
        }
    };

    const navLink = (to: string, text: string, parent = false, icon = 'settings') => <NavLink to={to}
        className={({ isActive }) => `${parent ? 'qb-admin-nav-parent qb-admin-approval-link' : 'qb-admin-nav-child'} ${isActive ? 'is-active' : ''}`}
        aria-disabled={isSubmitting} onClick={event => { if (requestRef.current) event.preventDefault(); }}>
        {parent && <AdminIcon name={icon} aria-hidden='true' />}{text}
    </NavLink>;

    return <div className='qb-admin-page'>
        <aside className='qb-admin-sidebar' aria-label='관리자 메뉴'>
            <div className='qb-admin-brand'><strong>Question Bank</strong><span>관리자 페이지</span></div>
            <nav className='qb-admin-navigation'>
                <div className={`qb-admin-nav-parent ${isProblemPage ? 'is-active' : ''}`}><AdminIcon name='file' aria-hidden='true' /><span>문제 관리</span></div>
                {navLink(ADMIN_UPLOAD_ABSOLUTE_PATH, '문제 업로드')}
                {navLink(ADMIN_QUESTIONS_ABSOLUTE_PATH, '문제 목록')}
                {navLink(ADMIN_APPROVALS_ABSOLUTE_PATH, '승인번호 관리', true)}
                {navLink(ADMIN_MEMBERS_ABSOLUTE_PATH, '회원 관리', true, 'users')}
            </nav>
        </aside>
        <main className={`qb-admin-main ${isListPage ? 'qb-admin-list-main' : ''} ${isMemberPage ? 'qb-admin-member-main' : ''}`}>
            <div className='qb-admin-breadcrumb'><span>{isMemberPage ? '회원 관리' : isApprovalPage ? '관리' : '문제 관리'}</span><AdminIcon name='chevron' size={15} aria-hidden='true' /><strong>{title}</strong></div>
            <header className='qb-admin-heading'><h1>{title}</h1><p>{isMemberPage ? '회원 목록과 회원별 학습 현황을 확인하세요.' : isApprovalPage ? '수신 전화번호를 입력하고 승인번호를 발송하세요.' : isListPage ? '회차 또는 난이도를 선택하여 등록된 문제를 조회하세요.' : '파일을 선택한 후 문제를 확인·수정하고, 문제 등록 버튼을 눌러 저장하세요.'}</p></header>
            {isMemberPage ? <MemberManagement /> : isApprovalPage ? <ApprovalPanel /> : isListPage ? <QuestionList /> : <form onSubmit={event => event.preventDefault()} aria-busy={isSubmitting}>
                {!isListPage && <section className='qb-admin-card qb-admin-upload-card'>
                    <h2>문제 데이터 업로드</h2>
                    <p className='qb-admin-caption'>파일 선택만으로는 저장되지 않습니다. 이미지가 없는 문제도 등록할 수 있습니다.</p>
                    <fieldset className='qb-editor-upload-fields' disabled={isSubmitting || isRegistered}>
                        <legend className='qb-admin-sr-only'>JSON 및 이미지 파일 선택</legend>
                        <div className='qb-editor-file-grid'>
                            <div className='qb-admin-file-field'>
                                <strong>JSON 파일 <span className='qb-admin-required'>*</span></strong>
                                <input ref={jsonInputRef} className='qb-admin-sr-only' type='file' accept='.json,application/json' aria-label='JSON 파일 선택' onChange={event => { void selectJson(event.target.files?.[0]); event.target.value = ''; }} />
                                <button type='button' className={`qb-admin-dropzone ${dragging === 'json' ? 'is-dragging' : ''}`} onClick={() => jsonInputRef.current?.click()} onDragOver={event => { event.preventDefault(); if (!isSubmitting && !isRegistered) setDragging('json'); }} onDragLeave={() => setDragging(null)} onDrop={event => handleDrop(event, 'json')}>
                                    <AdminIcon name='file' size={32} aria-hidden='true' /><span>{isParsing ? 'JSON을 읽고 있습니다…' : 'JSON 파일을 드래그하거나 클릭하여 선택하세요.'}</span><small>.json · questions 배열</small>
                                </button>
                                {jsonFilename && <div className='qb-admin-selected-file'><span>{jsonFilename} · {questions.length}문제</span><button type='button' aria-label='JSON 파일 제거' onClick={() => {
                                    if (window.confirm('선택한 JSON과 편집 중인 문제를 제거할까요?')) { readSequenceRef.current += 1; setIsParsing(false); setQuestions([]); setJsonFilename(''); setHasValidated(false); setMessage(null); }
                                }}><AdminIcon name='close' size={16} /></button></div>}
                            </div>
                            <div className='qb-admin-file-field'>
                                <strong>이미지 파일 <span className='qb-admin-optional'>(선택)</span></strong>
                                <input ref={imageInputRef} className='qb-admin-sr-only' type='file' accept={IMAGE_ACCEPT} multiple aria-label='이미지 파일 선택' onChange={event => { addImages(Array.from(event.target.files || [])); event.target.value = ''; }} />
                                <button type='button' className={`qb-admin-dropzone ${dragging === 'images' ? 'is-dragging' : ''}`} onClick={() => imageInputRef.current?.click()} onDragOver={event => { event.preventDefault(); if (!isSubmitting && !isRegistered) setDragging('images'); }} onDragLeave={() => setDragging(null)} onDrop={event => handleDrop(event, 'images')}>
                                    <AdminIcon name='image' size={32} aria-hidden='true' /><span>이미지 파일을 여러 개 드래그하거나 클릭하여 선택하세요.</span><small>PNG, JPG, JPEG, WEBP · 파일당 10MB 이하</small>
                                </button>
                            </div>
                        </div>
                        {images.length > 0 && <ul className='qb-editor-image-files'>{images.map(image => <li key={image.file.name}>
                            <img src={image.previewUrl} alt='' /><span>{image.file.name}</span><button type='button' aria-label={`${image.file.name} 제거`} onClick={() => deleteImage(image.file.name)}><AdminIcon name='close' size={16} /></button>
                        </li>)}</ul>}
                    </fieldset>
                </section>}
                <section className='qb-editor-preview-heading'>
                    <div><h2>문제 미리보기 및 수정 <span>{questions.length}</span></h2><p>변경한 지문·선택지·정답·해설이 미리보기에 바로 반영됩니다.</p></div>
                    <div className='qb-admin-tabs' aria-label='문제 유형 필터'>{['전체', '모의고사', '기출문제'].map(type => <button key={type} type='button' className={filter === type ? 'is-active' : ''} aria-pressed={filter === type} onClick={() => setFilter(type)}>{type}</button>)}</div>
                </section>
                {issues.length > 0 && <div ref={errorRef} tabIndex={-1} role='alert' className='qb-editor-validation'><strong>등록 전에 다음 항목을 확인해주세요.</strong><ul>{issues.map(issue => <li key={issue.key}><button type='button' onClick={() => { setFilter('전체'); requestAnimationFrame(() => document.getElementById(issue.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}>{issue.number}번 문제</button>: {issue.messages.join(' ')}</li>)}</ul></div>}
                <datalist id='qb-difficulties'><option value='상' /><option value='중' /><option value='하' /></datalist>
                {!questions.length && <div className='qb-admin-card qb-editor-empty'>JSON 파일을 선택하면 문제 카드가 표시됩니다.</div>}
                {questions.length > 0 && !questions.some(question => filter === '전체' || question.questionType === filter) && <div className='qb-admin-card qb-editor-empty'>선택한 유형의 문제가 없습니다.</div>}
                {questions.map((question, index) => (filter === '전체' || question.questionType === filter) && <QuestionCard key={question.key} question={question} number={index + 1} images={images} disabled={locked} errors={issues.find(issue => issue.key === question.key)?.messages || []} onChange={changeQuestion} />)}
                <footer className='qb-admin-card qb-editor-submit-panel'>
                    <div><strong>전체 {questions.length}문제</strong><p>문제 등록 시 수정한 JSON과 선택한 이미지 {images.length}개를 함께 전송합니다.</p></div>
                    <div className='qb-editor-submit-actions'>
                        {isRegistered ? <button type='button' className='qb-admin-submit' onClick={reset}>새 등록 시작</button> : <>
                            <button type='button' className='qb-editor-secondary' disabled={isSubmitting || isParsing || (!questions.length && !images.length)} onClick={() => { if (window.confirm('선택한 파일과 수정 내용을 모두 초기화할까요?')) reset(); }}>초기화</button>
                            <button type='button' className='qb-admin-submit' disabled={locked || !questions.length} onClick={submitQuestions}>{isSubmitting ? '등록 중…' : '문제 등록'}</button>
                        </>}
                    </div>
                </footer>
                {message && <p className={`qb-editor-result ${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}
            </form>}
        </main>
    </div>;
}
