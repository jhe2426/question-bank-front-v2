import React from 'react';
import { Link, Navigate, Outlet } from 'react-router';
import { AUTH_ABSOLUTE_PATH, MAIN_ABSOLUTE_PATH } from 'src/constants';
import useAdminAccess from 'src/hooks/admin-access.hook';

// component: Layout에서 로그인 복구를 마친 후 서버의 관리자 확인 결과로 접근 제어 //
export default function AdminRoute() {
    const { status, retry } = useAdminAccess();

    if (status === 'checking') return <main className='auth-access-status' role='status'>관리자 권한을 확인하고 있습니다…</main>;
    if (status === 'unauthenticated') return <Navigate to={AUTH_ABSOLUTE_PATH} replace />;
    if (status === 'allowed') return <Outlet />;

    return <main className='auth-access-status'>
        <div role='alert'>
            <h1>{status === 'denied' ? '관리자 권한이 필요합니다.' : '관리자 권한을 확인하지 못했습니다.'}</h1>
            <p>{status === 'denied' ? '이 계정으로는 관리자 페이지에 접근할 수 없습니다.' : '연결 상태를 확인한 후 다시 시도해주세요.'}</p>
        </div>
        <div className='auth-access-actions'>
            {status === 'error' && <button type='button' onClick={retry}>다시 확인</button>}
            <Link to={MAIN_ABSOLUTE_PATH}>메인페이지로</Link>
        </div>
    </main>;
}
