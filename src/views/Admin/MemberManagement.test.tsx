import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuthStore } from 'src/stores';
import MemberManagement, { formatLearningTime } from './MemberManagement';
import { AdminMemberDataSource, AdminMemberLearningDetail, AdminMemberPage } from './admin-member.types';

jest.mock('./admin-member-data', () => ({
    adminMemberDataSource: { getMembers: jest.fn(), getMemberDetail: jest.fn() }
}));

const users = [
    { userId: 'member-a', userName: '회원 A', phoneNumber: '010-1111-2222' },
    { userId: 'member-b', userName: '회원 B', phoneNumber: '010-3333-4444' }
];
const page = (overrides: Partial<AdminMemberPage> = {}): AdminMemberPage => ({
    users, totalElements: 22, totalPages: 2, page: 0, size: 20, last: false, ...overrides
});

beforeEach(() => useAuthStore.setState({ accessToken: 'admin-token' }));
afterEach(() => useAuthStore.setState({ accessToken: null }));

test('loads the first member page, pages on the server, and resets to page zero when searching', async () => {
    const getMembers = jest.fn(async (_keyword: string, requestedPage: number) =>
        requestedPage === 0 ? page() : page({ users: [], page: 1, last: true }));
    const source: AdminMemberDataSource = { getMembers, getMemberDetail: jest.fn() };
    render(<MemberManagement dataSource={source} />);

    expect(await screen.findByText('member-a')).toBeInTheDocument();
    expect(getMembers).toHaveBeenCalledWith('', 0, 'admin-token');
    expect(screen.getAllByText('전체 22명').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(getMembers).toHaveBeenCalledWith('', 1, 'admin-token'));

    fireEvent.change(screen.getByRole('searchbox', { name: '회원 검색' }), { target: { value: '010-3333' } });
    await waitFor(() => expect(getMembers).toHaveBeenCalledWith('010-3333', 0, 'admin-token'));
});

test('requests the selected user learning summary and renders seconds and null time correctly', async () => {
    const getMemberDetail = jest.fn(async () => ({
        ...users[0],
        totalSolvedCount: 120,
        totalSolveSeconds: 12300,
        sectionSummaries: [
            { sectionId: 1, sectionName: '데이터의 이해', solvedCount: 35, totalSolveSeconds: 2700 },
            { sectionId: 2, sectionName: '데이터 분석 기획', solvedCount: 40, totalSolveSeconds: null }
        ]
    }));
    const source: AdminMemberDataSource = { getMembers: async () => page(), getMemberDetail };
    render(<MemberManagement dataSource={source} />);

    fireEvent.click((await screen.findAllByRole('button', { name: '회원정보' }))[0]);
    const dialog = await screen.findByRole('dialog', { name: '회원 상세 정보' });
    await waitFor(() => expect(getMemberDetail).toHaveBeenCalledWith('member-a', 'admin-token'));
    expect(await within(dialog).findByText('3시간 25분')).toBeInTheDocument();
    expect(within(dialog).getByText('120문제')).toBeInTheDocument();
    expect(within(dialog).getByText('45분')).toBeInTheDocument();
    expect(within(dialog).getByText('기록 없음')).toBeInTheDocument();
});

test('shows an empty learning record and clears the previous user detail when switching members', async () => {
    let resolveSecond: ((value: AdminMemberLearningDetail) => void) | undefined;
    const getMemberDetail = jest.fn((userId: string): Promise<AdminMemberLearningDetail> => userId === 'member-a'
        ? Promise.resolve({ ...users[0], totalSolvedCount: 3, totalSolveSeconds: 4200, sectionSummaries: [] })
        : new Promise(resolve => { resolveSecond = resolve; }));
    const source: AdminMemberDataSource = { getMembers: async () => page(), getMemberDetail };
    render(<MemberManagement dataSource={source} />);

    const buttons = await screen.findAllByRole('button', { name: '회원정보' });
    fireEvent.click(buttons[0]);
    expect(await screen.findByText('1시간 10분')).toBeInTheDocument();
    expect(screen.getByText('학습 기록이 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '회원 상세 정보 닫기' }));

    fireEvent.click(buttons[1]);
    expect(screen.getByRole('status')).toHaveTextContent('회원 학습 정보를 불러오고 있습니다');
    expect(screen.queryByText('1시간 10분')).not.toBeInTheDocument();
    resolveSecond?.({ ...users[1], totalSolvedCount: 0, totalSolveSeconds: null, sectionSummaries: [] });
    expect(await screen.findByText('기록 없음')).toBeInTheDocument();
});

test('renders list and detail errors and keeps modal close behavior', async () => {
    const listErrorSource: AdminMemberDataSource = {
        getMembers: async () => { throw new Error('관리자 권한이 필요합니다.'); },
        getMemberDetail: jest.fn()
    };
    const first = render(<MemberManagement dataSource={listErrorSource} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('관리자 권한이 필요합니다.');
    first.unmount();

    const detailErrorSource: AdminMemberDataSource = {
        getMembers: async () => page({ users: [users[0]], totalElements: 1, totalPages: 1, last: true }),
        getMemberDetail: async () => { throw new Error('회원을 찾을 수 없습니다.'); }
    };
    render(<MemberManagement dataSource={detailErrorSource} />);
    const openButton = await screen.findByRole('button', { name: '회원정보' });
    fireEvent.click(openButton);
    expect(await screen.findByRole('alert')).toHaveTextContent('회원을 찾을 수 없습니다.');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(openButton).toHaveFocus());
});

test('formats learning seconds in hours and minutes without inventing null values', () => {
    expect(formatLearningTime(null)).toBe('기록 없음');
    expect(formatLearningTime(0)).toBe('0분');
    expect(formatLearningTime(2700)).toBe('45분');
    expect(formatLearningTime(4200)).toBe('1시간 10분');
    expect(formatLearningTime(12300)).toBe('3시간 25분');
});
