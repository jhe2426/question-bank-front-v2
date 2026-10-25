import { getAdminMemberLearningSummaryRequest, getAdminMembersRequest } from 'src/apis';
import { AdminMemberDataSource } from './admin-member.types';

export const adminMemberDataSource: AdminMemberDataSource = {
    getMembers: getAdminMembersRequest,
    getMemberDetail: getAdminMemberLearningSummaryRequest
};
