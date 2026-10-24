// 서버가 저장한 절대/상대 이미지 경로를 현재 API 라우팅에 맞춥니다.
export function adminImageUrl(raw: string | null): string | undefined {
    if (!raw) return undefined;
    const apiOrigin = process.env.NODE_ENV === 'production' ? '' : (process.env.REACT_APP_API_DOMAIN || '');
    if (raw.startsWith('/api/')) return `${apiOrigin}${raw}`;
    try {
        const parsed = new URL(raw);
        if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
        // 개발 서버 주소가 DB에 남은 경우 현재 환경의 /api 프록시 또는 개발 API를 사용합니다.
        if (['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname.startsWith('/api/')) {
            return `${apiOrigin}${parsed.pathname}${parsed.search}`;
        }
        return parsed.href;
    } catch { return undefined; }
}
