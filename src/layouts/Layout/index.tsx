import React, { useEffect, useRef } from 'react';
import { matchPath, Outlet, useLocation, useNavigate } from 'react-router';

import './style.css';
import { logoutRequest, refreshAccessTokenRequest } from 'src/apis';
import { useAuthStore } from 'src/stores';
import { useCookies } from 'react-cookie';
import useAdminAccess from 'src/hooks/admin-access.hook';
import { ResponseDto } from 'src/apis/dto/response';
import { ADMIN_ABSOLUTE_PATH, AUTH_ABSOLUTE_PATH, GRADING_VIEW_PATH, INCORRECT_QUESTIONS_TEST_PATH, KILLER_EXAM_TEST_PATH, MAIN_ABSOLUTE_PATH, MOCK_EXAM_TEST_PATH, MY_PAGE_ABSOLUTE_PATH, PAST_EXAM_TEST_PATH } from 'src/constants';

// component: 공통 레이아웃 컴포넌트 //
export default function Layout({ standalone = false }: { standalone?: boolean }) {

    // state: 경로 상태 //
    const { pathname } = useLocation();

    // state: cookie 상태 //
    const[cookies] = useCookies();

    // state: accessToken 정보 상태 //
    const { accessToken, setAccessToken, clearAuth } = useAuthStore();

    // state: 일반 화면의 관리자 메뉴는 서버 확인 후 표시 //
    const { status: adminAccess } = useAdminAccess(!standalone);
    const restoreRequest = useRef<{ csrfToken: string; promise: ReturnType<typeof refreshAccessTokenRequest> } | null>(null);

    // variable: csrf token //
    const csrfToken = cookies['csrfToken'];

    // variable: 메인페이지 메뉴 활성화 여부 //
    const isMainPage = pathname.startsWith(MAIN_ABSOLUTE_PATH);

    // variable: 메인 클래스 //
    const mainClass = pathname.startsWith(MAIN_ABSOLUTE_PATH) || pathname.startsWith(MY_PAGE_ABSOLUTE_PATH) ? '' : 'small-margin';

    // variable: 화면별 반응형 스타일 적용 클래스 //
    const isExamPage = [MOCK_EXAM_TEST_PATH, KILLER_EXAM_TEST_PATH, PAST_EXAM_TEST_PATH, INCORRECT_QUESTIONS_TEST_PATH]
        .some(path => matchPath(path, pathname));
    const layoutClass = pathname.startsWith(MAIN_ABSOLUTE_PATH) ? 'main-page'
        : pathname.startsWith(MY_PAGE_ABSOLUTE_PATH) ? 'mypage-page'
        : isExamPage ? 'exam-page'
        : matchPath(GRADING_VIEW_PATH, pathname) ? 'grade-page' : undefined;

    // function: 네비게이터 함수 //
    const navigator = useNavigate();

    // function: logout response 처리 함수 //
    const logoutResponse = (responseBody: ResponseDto | null) => {
        const isSuccess = responseBody !== null && responseBody.code === 'SU';
        if (isSuccess) {
            clearAuth();
            navigator(AUTH_ABSOLUTE_PATH);
        }
    };

    // event handler: 메인 로고 클릭 이벤트 처리 //
    const onMainLogoClickHandler = () => {
        navigator(MAIN_ABSOLUTE_PATH);
    };
    
    // event handler: 마이페이지 클릭 이벤트 처리 //
    const onMyPageClickHandler = () => {
        navigator(MY_PAGE_ABSOLUTE_PATH);
    };

    // event handler: 메인페이지 클릭 이벤트 처리 //
    const onMainPageClickHandler = () => {
        navigator(MAIN_ABSOLUTE_PATH);
    };

    // event handler: 로그아웃 클릭 이벤트 처리 //
    const onLogoutClickHandler = () => {
        if (accessToken == null) {
            navigator(AUTH_ABSOLUTE_PATH);
            return;
        }
        
        logoutRequest(accessToken).then(logoutResponse);
    };

    // effect: 기존 CSRF 쿠키로 로그인 복구 후 관리자 확인을 시작 //
    useEffect(() => {
        if (accessToken) { restoreRequest.current = null; return; }
        if (!csrfToken) { navigator(AUTH_ABSOLUTE_PATH, { replace: true }); return; }

        let cancelled = false;
        // StrictMode effect 재실행 시 같은 refresh 요청을 중복 전송하지 않습니다.
        if (!restoreRequest.current || restoreRequest.current.csrfToken !== csrfToken) {
            restoreRequest.current = { csrfToken, promise: refreshAccessTokenRequest(csrfToken) };
        }
        const fail = () => {
            if (cancelled) return;
            clearAuth();
            navigator(AUTH_ABSOLUTE_PATH, { replace: true });
        };
        restoreRequest.current.promise.then(response => {
            if (cancelled) return;
            if (response?.code !== 'SU' || !('accessToken' in response) || typeof response.accessToken !== 'string' || !response.accessToken) {
                fail();
                return;
            }
            setAccessToken(response.accessToken);
        }).catch(fail);
        return () => { cancelled = true; };
    }, [accessToken, csrfToken, navigator, setAccessToken, clearAuth]);

    // render: 토큰 복구 전에는 관리자 라우트 및 메뉴를 렌더링하지 않음 //
    if (!accessToken) return <main className='auth-access-status' role='status'>로그인 정보를 확인하고 있습니다…</main>;
    if (standalone) return <Outlet />;

    // render: 공통 레이아웃 컴포넌트 렌더링 //
    return (
        <div id='layout-wrapper' className={layoutClass}>
            {/* render: 모든 화면에서 사용하는 공통 서비스 헤더 */}
            <header id='top-bar'>
                <button type='button' className='main-brand' onClick={onMainLogoClickHandler} aria-label='ADsP 문제은행 메인페이지'>
                    <span className='main-brand-icon' aria-hidden='true'>
                        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'><path d='M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10l-7-7Zm0 0v7h7M8 14l2 2 5-5M8 19h7' /></svg>
                    </span>
                    <span><strong>ADsP 문제은행</strong><small>ADsP LEARNING PLATFORM</small></span>
                </button>
                <nav className='navigation-list' aria-label='주 메뉴'>
                    <button type='button' onClick={onMainPageClickHandler} aria-current={isMainPage ? 'page' : undefined}>메인페이지</button>
                    <button type='button' onClick={onMyPageClickHandler} aria-current={pathname.startsWith(MY_PAGE_ABSOLUTE_PATH) ? 'page' : undefined}>마이페이지</button>
                    {adminAccess === 'allowed' && <button type='button' onClick={() => navigator(ADMIN_ABSOLUTE_PATH)}>관리자 페이지</button>}
                    <button type='button' onClick={onLogoutClickHandler}>로그아웃</button>
                </nav>
            </header>
            
            <div id='main' className={mainClass}>
                <Outlet />
            </div>
        </div>
    )
}
