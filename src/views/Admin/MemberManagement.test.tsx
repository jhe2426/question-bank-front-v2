import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemberManagement, { formatTotalLearningTime } from './MemberManagement';
import { AdminMemberDataSource } from './admin-member.types';

test('shows clearly labelled fixture members and opens their learning detail', async () => {
    render(<MemberManagement />);

    expect(await screen.findByText('테스트 회원 A')).toBeInTheDocument();
    expect(screen.getByText(/실제 회원 기록이 아닙니다/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '회원정보' })[0]);

    const dialog = await screen.findByRole('dialog', { name: '회원 상세 정보' });
    expect(within(dialog).getByText('010-0000-0001')).toBeInTheDocument();
    expect(await within(dialog).findByText('3시간 25분')).toBeInTheDocument();
    expect(within(dialog).getByText('120문제')).toBeInTheDocument();
    expect(within(dialog).getByText('데이터의 이해')).toBeInTheDocument();
    expect(within(dialog).getByText('70분')).toBeInTheDocument();
});

test('closes the member modal with Escape and backdrop click, then restores focus', async () => {
    render(<MemberManagement />);
    const openButton = (await screen.findAllByRole('button', { name: '회원정보' }))[0];
    fireEvent.click(openButton);
    await screen.findByRole('dialog');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(openButton).toHaveFocus());

    fireEvent.click(openButton);
    await screen.findByRole('dialog');
    fireEvent.mouseDown(screen.getByTestId('member-modal-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('renders list and detail loading, empty, and error states from separate data functions', async () => {
    let finishList: ((value: []) => void) | undefined;
    const loadingSource: AdminMemberDataSource = {
        isFixture: false,
        getMembers: () => new Promise(resolve => { finishList = resolve; }),
        getMemberDetail: jest.fn()
    };
    const { unmount } = render(<MemberManagement dataSource={loadingSource} />);
    expect(screen.getByRole('status')).toHaveTextContent('회원 목록을 불러오고 있습니다');
    finishList?.([]);
    expect(await screen.findByText('등록된 회원이 없습니다.')).toBeInTheDocument();
    unmount();

    const detailErrorSource: AdminMemberDataSource = {
        isFixture: false,
        getMembers: async () => [{ memberId: 9, name: 'API 회원', phoneNumber: '010-1111-2222' }],
        getMemberDetail: async () => { throw new Error('detail failed'); }
    };
    render(<MemberManagement dataSource={detailErrorSource} />);
    fireEvent.click(await screen.findByRole('button', { name: '회원정보' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('회원 학습 정보를 불러오지 못했습니다');
});

test('formats total learning time in hours and minutes', () => {
    expect(formatTotalLearningTime(0)).toBe('0분');
    expect(formatTotalLearningTime(80)).toBe('1시간 20분');
    expect(formatTotalLearningTime(120)).toBe('2시간');
});
