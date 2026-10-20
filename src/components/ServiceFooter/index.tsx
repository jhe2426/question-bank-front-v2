import React from 'react';
import './style.css';

// component: 메인·마이페이지에서 함께 사용하는 기존 서비스 푸터 //
export default function ServiceFooter() {
    return <footer className='service-footer main-footer'><span className='footer-brand'>ADsP 문제은행</span><p>오늘의 한 문제가 내일의 자신감으로</p><span>꾸준한 학습, 확실한 준비</span></footer>;
}
