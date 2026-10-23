const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const React = require('react');
const { MemoryRouter } = require('react-router');
const { render, screen, fireEvent, waitFor, act, cleanup } = require('@testing-library/react');
require('@testing-library/jest-dom');
const App = require('../../App').default;
const { useAuthStore } = require('../../stores');
const { getAdminCheckRequest, refreshAccessTokenRequest, logoutRequest } = require('../../apis');
let mockCookies = {};
const mockAdminMounted = jest.fn();
jest.mock('react-cookie', () => ({ useCookies: () => [mockCookies] }));
jest.mock('../../apis', () => ({ getAdminCheckRequest: jest.fn(), refreshAccessTokenRequest: jest.fn(), logoutRequest: jest.fn() }));
jest.mock('../../views/Admin', () => () => { mockAdminMounted(); return <div>보호된 관리자 화면</div>; });
jest.mock('../../views/Auth', () => () => <div>로그인 화면</div>);
jest.mock('../../views/Main', () => () => <div>메인 화면</div>);
jest.mock('../../views/MyPage', () => () => <div>마이페이지 화면</div>);
jest.mock('../../views/Test/Exam', () => () => null);
jest.mock('../../views/Test/Grade', () => () => null);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };
const open = (path = '/admin', strict = false) => {
    const app = <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>;
    return render(strict ? <React.StrictMode>{app}</React.StrictMode> : app);
};
beforeEach(() => {
    jest.resetAllMocks();
    mockCookies = {};
    useAuthStore.getState().setAccessToken('test-token');
});
afterEach(() => { cleanup(); useAuthStore.getState().clearAuth(); });

test('does not mount protected page while pending and renders only after server approval', async () => {
    const check = deferred();
    getAdminCheckRequest.mockReturnValue(check.promise);
    open();
    expect(screen.getByRole('status')).toHaveTextContent('관리자 권한을 확인');
    expect(mockAdminMounted).not.toHaveBeenCalled();
    await act(async () => check.resolve(200));
    expect(screen.getByText('보호된 관리자 화면')).toBeInTheDocument();
    expect(getAdminCheckRequest).toHaveBeenCalledWith('test-token');
});

test.each(['/admin', '/admin/upload', '/admin/questions', '/admin/approvals'])('403 blocks direct entry to %s without mounting admin', async path => {
    getAdminCheckRequest.mockResolvedValue(403);
    open(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('관리자 권한이 필요합니다.');
    expect(mockAdminMounted).not.toHaveBeenCalled();
});

test('missing login redirects without sending admin request', async () => {
    useAuthStore.getState().clearAuth();
    open();
    await screen.findByText('로그인 화면');
    expect(getAdminCheckRequest).not.toHaveBeenCalled();
    expect(mockAdminMounted).not.toHaveBeenCalled();
});

test('401 after interceptor handling redirects to login', async () => {
    getAdminCheckRequest.mockResolvedValue(401);
    open();
    await screen.findByText('로그인 화면');
    expect(mockAdminMounted).not.toHaveBeenCalled();
});

test.each([null, 404, 500])('unavailable check (%s) fails closed and permits explicit retry', async status => {
    getAdminCheckRequest.mockResolvedValueOnce(status).mockResolvedValueOnce(200);
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('관리자 권한을 확인하지 못했습니다.');
    expect(mockAdminMounted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
    await screen.findByText('보호된 관리자 화면');
    expect(getAdminCheckRequest).toHaveBeenCalledTimes(2);
});

test('restores login before permission check, including StrictMode refresh deduplication', async () => {
    useAuthStore.getState().clearAuth();
    mockCookies = { csrfToken: 'test-csrf' };
    const refresh = deferred();
    const check = deferred();
    refreshAccessTokenRequest.mockReturnValue(refresh.promise);
    getAdminCheckRequest.mockReturnValue(check.promise);
    open('/admin/upload', true);
    expect(screen.getByRole('status')).toHaveTextContent('로그인 정보를 확인');
    expect(refreshAccessTokenRequest).toHaveBeenCalledTimes(1);
    expect(refreshAccessTokenRequest).toHaveBeenCalledWith('test-csrf');
    expect(getAdminCheckRequest).not.toHaveBeenCalled();
    await act(async () => refresh.resolve({ code: 'SU', accessToken: 'restored-token' }));
    expect(screen.getByRole('status')).toHaveTextContent('관리자 권한을 확인');
    expect(getAdminCheckRequest).toHaveBeenCalledWith('restored-token');
    expect(mockAdminMounted).not.toHaveBeenCalled();
    await act(async () => check.resolve(200));
    expect(screen.getByText('보호된 관리자 화면')).toBeInTheDocument();
});

test('failed login restoration does not request permission or mount admin', async () => {
    useAuthStore.getState().clearAuth();
    mockCookies = { csrfToken: 'test-csrf' };
    refreshAccessTokenRequest.mockResolvedValue(null);
    open();
    await screen.findByText('로그인 화면');
    expect(getAdminCheckRequest).not.toHaveBeenCalled();
    expect(mockAdminMounted).not.toHaveBeenCalled();
});

test('admin menu is hidden until approved; entering admin performs its own fresh check', async () => {
    const check = deferred();
    getAdminCheckRequest.mockReturnValueOnce(check.promise).mockResolvedValueOnce(403);
    open('/main');
    expect(screen.queryByRole('button', { name: '관리자 페이지' })).not.toBeInTheDocument();
    await act(async () => check.resolve(200));
    fireEvent.click(screen.getByRole('button', { name: '관리자 페이지' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('관리자 권한이 필요합니다.');
    expect(getAdminCheckRequest).toHaveBeenCalledTimes(2);
    expect(mockAdminMounted).not.toHaveBeenCalled();
});

test('regular users do not see admin menu', async () => {
    getAdminCheckRequest.mockResolvedValue(403);
    open('/main');
    await act(async () => {});
    expect(screen.getByText('메인 화면')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '관리자 페이지' })).not.toBeInTheDocument();
});

test('token changes immediately hide old admin menu and ignore stale approvals', async () => {
    const stale = deferred();
    const current = deferred();
    getAdminCheckRequest.mockResolvedValueOnce(200).mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    open('/main');
    await screen.findByRole('button', { name: '관리자 페이지' });
    act(() => useAuthStore.getState().setAccessToken('second-token'));
    expect(screen.queryByRole('button', { name: '관리자 페이지' })).not.toBeInTheDocument();
    act(() => useAuthStore.getState().setAccessToken('third-token'));
    await act(async () => stale.resolve(200));
    expect(screen.queryByRole('button', { name: '관리자 페이지' })).not.toBeInTheDocument();
    await act(async () => current.resolve(403));
    expect(screen.queryByRole('button', { name: '관리자 페이지' })).not.toBeInTheDocument();
});

test('logout clears session and removes admin menu', async () => {
    getAdminCheckRequest.mockResolvedValue(200);
    logoutRequest.mockResolvedValue({ code: 'SU' });
    open('/main');
    await screen.findByRole('button', { name: '관리자 페이지' });
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
    expect(screen.queryByRole('button', { name: '관리자 페이지' })).not.toBeInTheDocument();
    expect(screen.getByText('로그인 화면')).toBeInTheDocument();
});
