import React, { useState } from 'react';
import { renderContentWithMath } from '../Test/components/TestUi';
import { OPTION_FIELDS, QuestionDraft, SelectedImage } from './question-draft';

interface ImageFieldProps {
    label: string;
    fieldId: string;
    filename: string;
    images: SelectedImage[];
    onChange: (filename: string) => void;
}

// component: 업로드 파일명 선택 및 누락된 참조 안내 //
function ImageField({ label, fieldId, filename, images, onChange }: ImageFieldProps) {
    const missing = !!filename && !images.some(image => image.file.name === filename);
    return <label className='qb-editor-field' htmlFor={fieldId}>
        <span>{label}</span>
        <select id={fieldId} value={filename} onChange={event => onChange(event.target.value)}>
            <option value=''>이미지 없음</option>
            {missing && <option value={filename}>{filename} (파일 누락)</option>}
            {images.map(image => <option key={image.file.name} value={image.file.name}>{image.file.name}</option>)}
        </select>
        {missing && <small className='qb-editor-missing'>누락된 파일: {filename}</small>}
    </label>;
}

interface QuestionCardProps {
    question: QuestionDraft;
    number: number;
    images: SelectedImage[];
    disabled: boolean;
    errors: string[];
    onChange: (key: string, update: Partial<QuestionDraft>) => void;
}

// component: 시험 형태 미리보기와 문제별 편집 폼 //
export default function QuestionCard({ question, number, images, disabled, errors, onChange }: QuestionCardProps) {
    const [expanded, setExpanded] = useState(number <= 3);
    const isExpanded = expanded || errors.length > 0;
    const update = (patch: Partial<QuestionDraft>) => onChange(question.key, patch);
    const detail = question.detailedExplanation;
    const questionImage = images.find(image => image.file.name === question.imageFileName);
    const detailImage = images.find(image => image.file.name === detail?.imageFileName);
    const fieldId = (name: string) => `${question.key}-${name}`;
    const changeType = (questionType: string) => update({
        questionType,
        ...(questionType === '기출문제' ? { tags: '' } : { pastExamId: '', questionOrder: '' })
    });

    return <article className={`qb-admin-card qb-editor-question${errors.length ? ' has-errors' : ''}`} id={question.key}>
        <header className='qb-editor-question-header'>
            <span className='qb-editor-number'>{String(number).padStart(2, '0')}</span>
            <div><h2>{number}번 문제</h2><p>{question.questionType || '유형 미선택'} · 섹션 {question.sectionId || '-'} · 난이도 {question.difficulty || '미지정'}</p></div>
            <button type='button' className='qb-editor-secondary' aria-expanded={isExpanded} aria-controls={`${question.key}-body`} onClick={() => setExpanded(value => !value)}>{isExpanded ? '접기' : '펼치기'}</button>
        </header>
        {isExpanded && <div id={`${question.key}-body`}>
            {errors.length > 0 && <ul className='qb-editor-card-errors'>{errors.map(message => <li key={message}>{message}</li>)}</ul>}
            <div className='qb-editor-question-layout'>
                <section className='qb-editor-preview' aria-label={`${number}번 문제 미리보기`}>
                    <span className='qb-editor-eyebrow'>문제 미리보기</span>
                    <h3>{question.questionText ? renderContentWithMath(question.questionText) : '문제 지문을 입력해주세요.'}</h3>
                    {questionImage ? <img className='qb-editor-preview-image' src={questionImage.previewUrl} alt={`${number}번 문제 이미지`} />
                        : question.imageFileName && <p className='qb-editor-missing'>누락된 문제 이미지: {question.imageFileName}</p>}
                    <ol className='qb-editor-options'>
                        {OPTION_FIELDS.map((field, index) => <li key={field} className={question.answer === String(index + 1) ? 'is-correct' : ''}>
                            <span className='qb-editor-option-number'>{index + 1}</span>
                            <span>{renderContentWithMath(question[field]) || `선택지 ${index + 1}`}</span>
                            {question.answer === String(index + 1) && <strong>정답</strong>}
                        </li>)}
                    </ol>
                    <p className='qb-editor-answer'>정답 번호: {question.answer || '미선택'}</p>
                    {question.shortExplanation && <div className='qb-editor-explanation'><h4>간단 해설</h4><div>{renderContentWithMath(question.shortExplanation)}</div></div>}
                    {detail && <div className='qb-editor-explanation'><h4>상세 해설</h4><div>{renderContentWithMath(detail.content)}</div>
                        {detailImage ? <img className='qb-editor-preview-image' src={detailImage.previewUrl} alt={`${number}번 상세 해설 이미지`} />
                            : detail.imageFileName && <p className='qb-editor-missing'>누락된 상세 해설 이미지: {detail.imageFileName}</p>}
                    </div>}
                    <p className='qb-editor-metadata'>{question.questionType === '모의고사' ? `기출 회차 태그: ${question.tags || '없음'}`
                        : `기출 회차 ID: ${question.pastExamId || '-'} · 문항 순서: ${question.questionOrder || '-'}`}</p>
                </section>
                <fieldset className='qb-editor-fields' disabled={disabled}>
                    <legend className='qb-admin-sr-only'>{number}번 문제 수정</legend>
                    <div className='qb-editor-metadata-grid'>
                        <label className='qb-editor-field' htmlFor={fieldId('type')}><span>문제 유형</span><select id={fieldId('type')} value={question.questionType} onChange={event => changeType(event.target.value)}>
                            {!['모의고사', '기출문제'].includes(question.questionType) && <option value={question.questionType}>{question.questionType || '유형 선택'}</option>}
                            <option value='모의고사'>모의고사</option><option value='기출문제'>기출문제</option>
                        </select></label>
                        <label className='qb-editor-field' htmlFor={fieldId('section')}><span>섹션 ID</span><input id={fieldId('section')} inputMode='numeric' value={question.sectionId} onChange={event => update({ sectionId: event.target.value })} /></label>
                        <label className='qb-editor-field' htmlFor={fieldId('difficulty')}><span>난이도</span><input id={fieldId('difficulty')} list='qb-difficulties' value={question.difficulty} onChange={event => update({ difficulty: event.target.value })} placeholder='상 / 중 / 하' /></label>
                    </div>
                    <label className='qb-editor-field' htmlFor={fieldId('text')}><span>문제 지문 <small>{question.questionText.length}/255</small></span><textarea id={fieldId('text')} rows={4} value={question.questionText} onChange={event => update({ questionText: event.target.value })} /></label>
                    <ImageField label='문제 이미지' fieldId={fieldId('image')} filename={question.imageFileName} images={images} onChange={imageFileName => update({ imageFileName })} />
                    {OPTION_FIELDS.map((field, index) => <label className='qb-editor-field' key={field} htmlFor={fieldId(field)}><span>선택지 {index + 1}</span><input id={fieldId(field)} value={question[field]} onChange={event => update({ [field]: event.target.value })} /></label>)}
                    <label className='qb-editor-field' htmlFor={fieldId('answer')}><span>정답 번호</span><select id={fieldId('answer')} value={question.answer} onChange={event => update({ answer: event.target.value })}>
                        {!['1', '2', '3', '4'].includes(question.answer) && <option value={question.answer}>{question.answer ? `잘못된 정답: ${question.answer}` : '정답 선택'}</option>}
                        {[1, 2, 3, 4].map(answer => <option key={answer} value={answer}>{answer}번</option>)}
                    </select></label>
                    <label className='qb-editor-field' htmlFor={fieldId('short')}><span>간단 해설</span><textarea id={fieldId('short')} rows={2} value={question.shortExplanation} onChange={event => update({ shortExplanation: event.target.value })} /></label>
                    <label className='qb-editor-check'><input type='checkbox' checked={detail !== null} onChange={event => update({ detailedExplanation: event.target.checked ? { content: '', imageFileName: '' } : null })} />상세 해설 사용</label>
                    {detail && <>
                        <label className='qb-editor-field' htmlFor={fieldId('detail')}><span>상세 해설 내용</span><textarea id={fieldId('detail')} rows={4} value={detail.content} onChange={event => update({ detailedExplanation: { ...detail, content: event.target.value } })} /></label>
                        <ImageField label='상세 해설 이미지' fieldId={fieldId('detail-image')} filename={detail.imageFileName} images={images} onChange={imageFileName => update({ detailedExplanation: { ...detail, imageFileName } })} />
                    </>}
                    {(question.questionType === '모의고사' || question.tags) && <label className='qb-editor-field' htmlFor={fieldId('tags')}><span>모의고사 기출 회차 태그</span><input id={fieldId('tags')} value={question.tags} onChange={event => update({ tags: event.target.value })} placeholder='35,36,37' /></label>}
                    {question.questionType === '기출문제' && <div className='qb-editor-metadata-grid'>
                        <label className='qb-editor-field' htmlFor={fieldId('past')}><span>기출 회차 ID</span><input id={fieldId('past')} inputMode='numeric' value={question.pastExamId} onChange={event => update({ pastExamId: event.target.value })} /></label>
                        <label className='qb-editor-field' htmlFor={fieldId('order')}><span>기출문제 순서</span><input id={fieldId('order')} inputMode='numeric' value={question.questionOrder} onChange={event => update({ questionOrder: event.target.value })} /></label>
                    </div>}
                </fieldset>
            </div>
        </div>}
    </article>;
}
