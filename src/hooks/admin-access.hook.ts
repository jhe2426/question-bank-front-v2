import { useEffect, useState } from 'react';
import { getAdminCheckRequest } from 'src/apis';
import { useAuthStore } from 'src/stores';

// type: 서버 확인 결과에 따른 UI 상태 (인가 정보로 저장하거나 영속화하지 않음) //
type AdminAccess = 'checking' | 'allowed' | 'denied' | 'unauthenticated' | 'error';

// hook: 현재 토큰으로 서버에 확인하며 이전 사용자/요청의 결과는 사용하지 않음 //
export default function useAdminAccess(enabled = true) {
    const { accessToken } = useAuthStore();
    const [result, setResult] = useState<{ token: string; attempt: number; status: AdminAccess } | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!enabled || !accessToken) return;
        let cancelled = false;
        getAdminCheckRequest(accessToken).then(status => {
            if (cancelled) return;
            setResult({ token: accessToken, attempt, status: status === 200 ? 'allowed'
                : status === 401 ? 'unauthenticated' : status === 403 ? 'denied' : 'error' });
        }).catch(() => {
            if (!cancelled) setResult({ token: accessToken, attempt, status: 'error' });
        });
        return () => { cancelled = true; };
    }, [accessToken, enabled, attempt]);

    // 토큰 변경 직후 effect가 실행되기 전에도 기존 allowed 결과를 노출하지 않습니다.
    const status: AdminAccess = enabled && accessToken && result?.token === accessToken && result.attempt === attempt
        ? result.status : 'checking';
    return { status, retry: () => setAttempt(value => value + 1) };
}
