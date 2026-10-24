export interface AdminMemberSummary {
    memberId: number;
    name: string;
    phoneNumber: string;
}

export interface AdminMemberSectionLearning {
    sectionId: number;
    sectionName: string;
    solvedQuestionCount: number;
    totalSolveMinutes: number;
}

export interface AdminMemberLearningDetail extends AdminMemberSummary {
    totalSolveMinutes: number;
    totalSolvedQuestionCount: number;
    sections: AdminMemberSectionLearning[];
}

export interface AdminMemberDataSource {
    isFixture: boolean;
    getMembers: () => Promise<AdminMemberSummary[]>;
    getMemberDetail: (memberId: number) => Promise<AdminMemberLearningDetail | null>;
}
