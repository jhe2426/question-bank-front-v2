import { AdminMemberDataSource, AdminMemberLearningDetail, AdminMemberSummary } from './admin-member.types';

// 백엔드 회원 API가 연결되기 전 화면 동작을 확인하기 위한 전용 테스트 데이터입니다.
const fixtureMembers: AdminMemberSummary[] = [
    { memberId: 1, name: '테스트 회원 A', phoneNumber: '010-0000-0001' },
    { memberId: 2, name: '테스트 회원 B', phoneNumber: '010-0000-0002' },
    { memberId: 3, name: '테스트 회원 C', phoneNumber: '010-0000-0003' }
];

const fixtureDetails: Record<number, AdminMemberLearningDetail> = {
    1: {
        ...fixtureMembers[0], totalSolveMinutes: 205, totalSolvedQuestionCount: 120,
        sections: [
            { sectionId: 1, sectionName: '데이터의 이해', solvedQuestionCount: 35, totalSolveMinutes: 45 },
            { sectionId: 2, sectionName: '데이터 분석 기획', solvedQuestionCount: 40, totalSolveMinutes: 70 },
            { sectionId: 3, sectionName: '데이터 분석', solvedQuestionCount: 28, totalSolveMinutes: 50 },
            { sectionId: 4, sectionName: '데이터 시각화', solvedQuestionCount: 12, totalSolveMinutes: 25 },
            { sectionId: 5, sectionName: '머신러닝', solvedQuestionCount: 5, totalSolveMinutes: 15 }
        ]
    },
    2: {
        ...fixtureMembers[1], totalSolveMinutes: 82, totalSolvedQuestionCount: 54,
        sections: [
            { sectionId: 1, sectionName: '데이터의 이해', solvedQuestionCount: 24, totalSolveMinutes: 37 },
            { sectionId: 2, sectionName: '데이터 분석 기획', solvedQuestionCount: 30, totalSolveMinutes: 45 }
        ]
    },
    3: { ...fixtureMembers[2], totalSolveMinutes: 0, totalSolvedQuestionCount: 0, sections: [] }
};

// 추후 회원 목록 API 함수로 교체할 경계입니다.
export async function getAdminMemberList(): Promise<AdminMemberSummary[]> {
    return Promise.resolve(fixtureMembers.map(member => ({ ...member })));
}

// 추후 회원 상세 학습 정보 API 함수로 교체할 경계입니다.
export async function getAdminMemberLearningDetail(memberId: number): Promise<AdminMemberLearningDetail | null> {
    const detail = fixtureDetails[memberId];
    return Promise.resolve(detail ? { ...detail, sections: detail.sections.map(section => ({ ...section })) } : null);
}

export const adminMemberDataSource: AdminMemberDataSource = {
    isFixture: true,
    getMembers: getAdminMemberList,
    getMemberDetail: getAdminMemberLearningDetail
};
