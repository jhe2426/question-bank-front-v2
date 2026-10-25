import {
    AdminMemberLearningDetail,
    AdminMemberPage
} from 'src/views/Admin/admin-member.types';

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isNullableNonNegativeInteger = (value: unknown): value is number | null =>
    value === null || isNonNegativeInteger(value);
const isPercentage = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

// 서버 GetAdminUserListResponseDto 응답을 검증합니다.
export function parseAdminMemberPage(data: unknown): AdminMemberPage {
    const value = data as Record<string, unknown> | null;
    if (!value || value.code !== 'SU' || !Array.isArray(value.users)
        || !isNonNegativeInteger(value.totalElements) || !isNonNegativeInteger(value.totalPages)
        || !isNonNegativeInteger(value.page) || !isNonNegativeInteger(value.size) || value.size < 1
        || typeof value.last !== 'boolean'
        || !value.users.every(user => user && typeof user.userId === 'string'
            && typeof user.userName === 'string' && typeof user.phoneNumber === 'string')) {
        throw new Error(typeof value?.message === 'string' && value.code !== 'SU'
            ? value.message : '회원 목록 응답 형식을 확인할 수 없습니다.');
    }
    return value as unknown as AdminMemberPage;
}

// 서버 GetAdminUserLearningSummaryResponseDto 응답을 검증합니다.
export function parseAdminMemberLearningDetail(data: unknown): AdminMemberLearningDetail {
    const value = data as Record<string, unknown> | null;
    if (!value || value.code !== 'SU' || typeof value.userId !== 'string'
        || typeof value.userName !== 'string' || typeof value.phoneNumber !== 'string'
        || !isNonNegativeInteger(value.totalSolvedCount)
        || !isNullableNonNegativeInteger(value.totalSolveSeconds)
        || !Array.isArray(value.sectionSummaries)
        || !value.sectionSummaries.every(section => section && isNonNegativeInteger(section.sectionId)
            && typeof section.sectionName === 'string' && isNonNegativeInteger(section.solvedCount)
            && isNonNegativeInteger(section.correctCount) && section.correctCount <= section.solvedCount
            && isPercentage(section.accuracyRate))) {
        throw new Error(typeof value?.message === 'string' && value.code !== 'SU'
            ? value.message : '회원 학습 현황 응답 형식을 확인할 수 없습니다.');
    }
    return value as unknown as AdminMemberLearningDetail;
}
