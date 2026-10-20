import React from 'react';
import { InlineMath } from 'react-katex';

// type: 시험·채점 화면 장식 아이콘 종류 //
type TestIconName = 'document' | 'clock' | 'target' | 'chart' | 'guide' | 'send' | 'left' | 'right' | 'explanation';

// component: 시험·채점 화면 공통 아이콘 컴포넌트 //
export function TestIcon({ name }: { name: TestIconName }) {
    // variable: 외부 라이브러리 없이 표시하는 아이콘 도형 //
    const paths: Record<TestIconName, React.ReactNode> = {
        document: <><path d='M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8M8 17h6' /></>,
        clock: <><circle cx='12' cy='12' r='9' /><path d='M12 6v6l4 2' /></>,
        target: <><circle cx='12' cy='12' r='9' /><circle cx='12' cy='12' r='5' /><circle cx='12' cy='12' r='1' /></>,
        chart: <><rect x='3' y='13' width='4' height='8' rx='1' /><rect x='10' y='7' width='4' height='14' rx='1' /><rect x='17' y='3' width='4' height='18' rx='1' /></>,
        guide: <><path d='M9 18h6m-5 3h4M8 13a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3ZM12 1v1M3 5l1 1m16 0 1-1' /></>,
        send: <><path d='m21 3-7 18-4-7-7-4 18-7Zm0 0L10 14' /></>,
        left: <path d='m14 5-7 7 7 7' />,
        right: <path d='m10 5 7 7-7 7' />,
        explanation: <><rect x='4' y='4' width='16' height='16' rx='3' /><path d='M9 8h4a2 2 0 0 1 0 4H9m0-4v8' /></>
    };

    // render: 스크린 리더에서 제외하는 장식 아이콘 렌더링 //
    return <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>{paths[name]}</svg>;
}

// function: 텍스트와 수식을 분리해서 렌더링하는 함수 //
export const renderContentWithMath = (text: string) => {
    if (!text) return null;
    return text.split(/(\$.*?\$)/g).filter(Boolean).map((part, index) => (
        part.startsWith('$') && part.endsWith('$')
            ? <InlineMath key={index} math={part.slice(1, -1).trim()} />
            : <span key={index}>{part}</span>
    ));
};


// interface: 시험·채점 화면의 공통 페이지 이동 속성 //
interface TestPaginationProps {
    currentPage: number;
    totalPage: number;
    disabled: boolean;
    onPageChange: (page: number) => void;
}

// component: 기존 3문항 단위 이전·다음 페이지 이동 //
export function TestPagination({ currentPage, totalPage, disabled, onPageChange }: TestPaginationProps) {
    return (
        <nav className='exam-pagination' aria-label='문제 페이지 이동'>
            <button type='button' className='exam-action-button' disabled={disabled || currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}><TestIcon name='left' /><span>이전 문제</span></button>
            <span className='exam-page-count' aria-live='polite' aria-label={`${currentPage} / ${totalPage} 페이지`}>{currentPage} / {totalPage}</span>
            <button type='button' className='exam-action-button' disabled={disabled || currentPage >= totalPage} onClick={() => onPageChange(currentPage + 1)}><span>다음 문제</span><TestIcon name='right' /></button>
        </nav>
    );
}

// component: 메인페이지와 일관된 시험·채점 화면의 하단 안내 //
export function TestFooter() {
    return <footer className='exam-footer'><strong>ADsP 문제은행</strong><p>오늘의 한 문제가 내일의 자신감으로.</p><span>꾸준한 학습, 확실한 준비.</span></footer>;
}
