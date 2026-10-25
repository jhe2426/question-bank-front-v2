export interface AdminMemberSummary {
    userId: string;
    userName: string;
    phoneNumber: string;
}

export interface AdminMemberPage {
    users: AdminMemberSummary[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
    last: boolean;
}

export interface AdminMemberSectionLearning {
    sectionId: number;
    sectionName: string;
    solvedCount: number;
    totalSolveSeconds: number | null;
}

export interface AdminMemberLearningDetail extends AdminMemberSummary {
    totalSolvedCount: number;
    totalSolveSeconds: number | null;
    sectionSummaries: AdminMemberSectionLearning[];
}

export interface AdminMemberDataSource {
    getMembers: (keyword: string, page: number, accessToken: string) => Promise<AdminMemberPage>;
    getMemberDetail: (userId: string, accessToken: string) => Promise<AdminMemberLearningDetail>;
}
