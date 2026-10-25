import { parseAdminQuestionDetail, PutAdminQuestionRequestDto } from './dto/response/admin/question-detail';
import { QuestionListFilter, parseAdminQuestionPage } from './dto/response/admin/question-list';
import { parseAdminMemberLearningDetail, parseAdminMemberPage } from './dto/response/admin/user';
import { PostQuestionsRequestDto } from './dto/request/admin';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { PostExamResponseDto, ResponseDto } from './dto/response';
import { ApprovalCodeRequestDto, ApprovalCodeVerifyRequestDto, IdCheckRequestDto, PhoneNumberAuthRequestDto, PhoneNumberAuthVerifyRequestDto, SignInRequestDto, SignUpRequestDto } from './dto/request/auth';
import { GetUniversityListResponseDto, RefreshAccessTokenResponseDto, SignInResponseDto } from './dto/response/auth';
import { useAuthStore } from 'src/stores';
import { AUTH_ABSOLUTE_PATH } from 'src/constants';
import { Cookies } from 'react-cookie';
import { GetPastExamRoundListResponseDto } from './dto/response/pastExam';
import { GetMockExamQuestionListResponseDto, GetUnitAndChapterListResponseDto } from './dto/response/mockExam';
import { GetKillerExamQuestionListResponseDto } from './dto/response/killerExam';
import { GetIncorrectQuestionListResponseDto } from './dto/response/incorrectQuestions';
import { PostKillerExamGradingRequestDto } from './dto/request/killerExam';
import { PostPastExamGradingRequestDto } from './dto/request/pastExam';
import { PostMockExamGradingRequestDto } from './dto/request/mockExam';
import { PostIncorrectQuestionGradingRequestDto } from './dto/request/incorrectQuestions';
import { GetExamResultListResponseDto } from './dto/response/examResult';
import { PatchUserPasswordRequestDto } from './dto/request/myPage';
import { GetLearningRecordListResponseDto, GetUnitGradingResultListResponseDto } from './dto/response/myPage';

// variable: URL 상수 //
const API_DOMAIN = process.env.NODE_ENV === 'production' ? '' : (process.env.REACT_APP_API_DOMAIN || '');

const AUTH_MODULE_URL = `${API_DOMAIN}/api/v1/auth`;

const SIGN_IN_URL = `${AUTH_MODULE_URL}/sign-in`;
const GET_UNIVERSITY_LIST_API_URL = `${AUTH_MODULE_URL}/universities`;
const ID_CHECK_URL = `${AUTH_MODULE_URL}/id-check`;
const PHONE_NUMBER_AUTH_URL = `${AUTH_MODULE_URL}/phone-number/auth-code`;
const PHONE_NUMBER_AUTH_VERIFY_URL = `${AUTH_MODULE_URL}/phone-number/auth-code/verify`;
const APPROVAL_CODE_URL = `${AUTH_MODULE_URL}/approval-code`;
const APPROVAL_CODE_VERIFY_URL = `${AUTH_MODULE_URL}/approval-code/verify`;
const SIGN_UP_URL = `${AUTH_MODULE_URL}/sign-up`;
const REFRESH_ACCESS_TOKEN_URL = `${AUTH_MODULE_URL}/refresh`;
const LOGOUT_URL = `${AUTH_MODULE_URL}/logout`;

const MOCK_EXAM_MODULE_URL = `${API_DOMAIN}/api/v1/mock-exam`;
const GET_UNIT_AND_CHAPTER_LIST_URL =`${MOCK_EXAM_MODULE_URL}/units-with-chapters`;
const GET_MOCK_EXAM_QUESTION_LIST_URL = (chapterId: number | string, difficulty: string, hasExplanation: boolean) => 
    `${MOCK_EXAM_MODULE_URL}/${chapterId}/${difficulty}/${hasExplanation}`;
const POST_MOCK_EXAM_GRADING_URL = `${MOCK_EXAM_MODULE_URL}/grading`;

const KILLER_EXAM_MODULE_URL = `${API_DOMAIN}/api/v1/killer-exam`;
const GET_KILLER_EXAM_QUESTION_LIST_URL = `${KILLER_EXAM_MODULE_URL}`;
const POST_KILLER_EXAM_GRADING_URL = `${KILLER_EXAM_MODULE_URL}/grading`;

const PAST_EXAM_MODULE_URL = `${API_DOMAIN}/api/v1/past-exam`;
const GET_PAST_EXAM_ROUND_LIST_URL = `${PAST_EXAM_MODULE_URL}`;
const GET_PAST_EXAM_QUESTION_LIST_URL = (pastExamId: number | string) => `${PAST_EXAM_MODULE_URL}/${pastExamId}`;
const POST_PAST_EXAM_GRADING_URL = `${PAST_EXAM_MODULE_URL}/grading`;

const INCORRECT_QUESTIONS_MODULE_URL =`${API_DOMAIN}/api/v1/incorrect-questions`;
const GET_INCORRECT_QUESTION_LIST_URL = (sourceType: string) => `${INCORRECT_QUESTIONS_MODULE_URL}/${sourceType}`;
const POST_INCORRECT_QUESTION_GRADING_URL = `${INCORRECT_QUESTIONS_MODULE_URL}/grading`;

const EXAM_RESULT_MODULE_URL = `${API_DOMAIN}/api/v1/exam-result`;
const GET_EXAM_RESULT_LIST_URL = (groupId: number, filter: string) => `${EXAM_RESULT_MODULE_URL}/${groupId}/${filter}`;

const MY_PAGE_MODULE_URL = `${API_DOMAIN}/api/v1/my-page`;
const PATCH_USER_PASSWORD_URL = `${MY_PAGE_MODULE_URL}/change-password`;
const GET_LEARNING_RECORD_LIST_URL = `${MY_PAGE_MODULE_URL}/learning-records`;
const GET_UNIT_GRADING_RESULT_LIST_URL = (groupId: number) => `${MY_PAGE_MODULE_URL}/${groupId}/unit-grading-results`;

const GET_ADMIN_CHECK_URL = `${API_DOMAIN}/api/admin/check`;
const POST_ADMIN_QUESTIONS_URL = `${API_DOMAIN}/api/admin/questions`;
const GET_ADMIN_USERS_URL = '/api/admin/users';

// variable: refresh 토큰을 사용하여 access Token 발급 진행 여부 //
let isRefreshing = false;

// variable: refresh 토큰 발급 중에 들어오는 다른 요청들의 콜백 함수 저장 //
let refreshQueue: ((token: string) => void)[] = [];

// variable: cookie instance //
const cookies = new Cookies();

// function: axios instance 함수 //
const api = axios.create({
    baseURL: API_DOMAIN,
    withCredentials: true
});

// function: api response interceptor 함수 //
api.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequet = error.config;

        const authStoreAccessToken = useAuthStore.getState().accessToken;
        const { clearAuth, setAccessToken } = useAuthStore.getState();
 
        if (!originalRequet || !authStoreAccessToken || error.response?.status !== 401) return Promise.reject(error);

        if (originalRequet.url?.includes(SIGN_IN_URL)) return Promise.reject(error);

        // description: 리프레쉬 요청 자체에서 401에 대해서는 로그아웃 진행 //
        if (originalRequet.url?.includes(REFRESH_ACCESS_TOKEN_URL)) {
            clearAuth();
            window.location.href = AUTH_ABSOLUTE_PATH;
            return Promise.reject(error);
        }

        // 재발급 후에도 401이면 같은 요청을 반복하지 않습니다.
        if (originalRequet._retry) return Promise.reject(error);
        originalRequet._retry = true;

        // description: 이미 리프레쉬 요청 중이면 다른 요청에 대해서 새로 발급한 액세스 토큰을 담아서 요청 //
        if (isRefreshing) {
            return new Promise((resolve) => {
                refreshQueue.push((newToken: string) => {
                    originalRequet.headers.Authorization = `Bearer ${newToken}`;
                    resolve(api(originalRequet));
                });
            });
        }

        isRefreshing = true;

        try {
            const csrfToken = cookies.get('csrfToken');
            if (!csrfToken) throw new Error('No CSRF Token');

            const response = await refreshAccessTokenRequest(csrfToken);

            if (response !== null && response.code !== 'SU') {
                throw new Error('');
            }
            
            const { accessToken } =  response as RefreshAccessTokenResponseDto;
            setAccessToken(accessToken);

            refreshQueue.forEach((cb) => cb(accessToken));
            refreshQueue = [];

            originalRequet.headers.Authorization = `Bearer ${accessToken}`;
            return api(originalRequet);
        } catch (e) {
            refreshQueue = [];
            clearAuth();
            window.location.href = AUTH_ABSOLUTE_PATH;
            return Promise.reject(e);
        } finally {
            isRefreshing = false;
        }
    }

);

// function: Authorization Bearer 헤더 //
const bearerAuthorization = (accessToken: string) => ({ headers: { 'Authorization': `Bearer ${accessToken}` } })

// function: response 성공 처리 함수 //
const responseSuccessHandler = <T = ResponseDto>(response: AxiosResponse<T>) => {
    const { data } = response;
    return data;
};

// function: response 실패 처리 함수 //
const responseErrorHandler = (error: AxiosError<ResponseDto>) => {
    if (!error.response) return null;
    const { data } = error.response;
    return data;
};

// function: sign in API 요청 함수 //
export const signInRequest = async (requestBody: SignInRequestDto) => {
    const responseBody = await api.post(SIGN_IN_URL, requestBody)
        .then(responseSuccessHandler<SignInResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: id check API 요청 함수 //
export const idCheckRequest = async (requestBody: IdCheckRequestDto) => {
    const responseBody = await api.post(ID_CHECK_URL, requestBody)
        .then(responseSuccessHandler)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: 전화번호 인증 API 요청 함수 //
export const phoneNumberAuthRequest = async (requestBody: PhoneNumberAuthRequestDto) => {
    const responseBody = await api.post(PHONE_NUMBER_AUTH_URL, requestBody)
        .then(responseSuccessHandler)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: 전화번호 인증 확인 API 요청 함수 //
export const phoneNumberAuthVerifyRequest = async (requestBody: PhoneNumberAuthVerifyRequestDto) => {
    const responseBody = await api.post(PHONE_NUMBER_AUTH_VERIFY_URL, requestBody)
        .then(responseSuccessHandler)
        .catch(responseErrorHandler);
    return responseBody;
};
 
// function: get university list 요청 함수 //
export const getUniversityListRequest = async () => {
    const responseBody = await api.get(GET_UNIVERSITY_LIST_API_URL)
        .then(responseSuccessHandler<GetUniversityListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: 관리자 화면의 승인번호 발송 API 요청 함수 //
export const approvalCodeRequest = async (requestBody: ApprovalCodeRequestDto, accessToken: string): Promise<ResponseDto | null> => {
    return api.post(APPROVAL_CODE_URL, requestBody, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<ResponseDto>)
        .catch(responseErrorHandler);
};

// function: 승인번호 확인 API 요청 함수 //
export const approvalCodeVerifyRequest = async (requestBody: ApprovalCodeVerifyRequestDto) => {
    const responseBody = await api.post(APPROVAL_CODE_VERIFY_URL, requestBody)
        .then(responseSuccessHandler)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: sign up API 요청 함수 //
export const signUpRequest = async (requestBody: SignUpRequestDto) => {
    const responseBody = await api.post(SIGN_UP_URL, requestBody)
        .then(responseSuccessHandler)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: refresh access token API 요청 함수 //
export const refreshAccessTokenRequest = async (csrfToken: string) => {
    const responseBody = await axios.post(REFRESH_ACCESS_TOKEN_URL, {}, 
            { 
                headers: { 'X-CSRF-TOKEN': csrfToken },
                withCredentials: true
            }
        )
        .then(responseSuccessHandler<RefreshAccessTokenResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: logout API 요청 함수 //
export const logoutRequest = async (accessToken: string) => {
    const responesBody = await api.post(LOGOUT_URL, {}, bearerAuthorization(accessToken)) 
        .then(responseSuccessHandler)
        .catch(responseErrorHandler);
    return responesBody;
};

// function: get unit and chapter list API 요청 함수 //
export const getUnitAndChapterListRequest = async (accessToken: string) => {
    const responseBody = await api.get(GET_UNIT_AND_CHAPTER_LIST_URL, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<GetUnitAndChapterListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: get past exam round list API 요청 함수 //
export const getPastExamRoundListRequest = async (accessToken: string) => {
    const responseBody = await api.get(GET_PAST_EXAM_ROUND_LIST_URL, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<GetPastExamRoundListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: get past exam question list API 요청 함수 //
export const getPastExamQuestionListRequest = async (accessToken: string, pastExamId: number | string) => {
    const responseBody = await api.get(GET_PAST_EXAM_QUESTION_LIST_URL(pastExamId), bearerAuthorization(accessToken))
        .then(responseSuccessHandler<GetPastExamRoundListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: get killer exam question list API 요청 함수 //
export const getKillerExamQuestionListRequest = async (accessToken: string) => {
    const responseBody = await api.get(GET_KILLER_EXAM_QUESTION_LIST_URL, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<GetKillerExamQuestionListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: get mock exam question list API 요청 함수 //
export const getMockExamQuestionListRequest = async (accessToken: string, chapterId: number, difficulty: string, hasExplanation: boolean) => {
    const responseBody = await api.get(GET_MOCK_EXAM_QUESTION_LIST_URL(chapterId, difficulty, hasExplanation), bearerAuthorization(accessToken))
        .then(responseSuccessHandler<GetMockExamQuestionListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: get incorrect question list API 요청 함수 //
export const getIncorrectQuestionListRequest = async (accessToken: string, sourceType: string) => {
    const responseBody = await api.get(GET_INCORRECT_QUESTION_LIST_URL(sourceType), bearerAuthorization(accessToken))
        .then(responseSuccessHandler<GetIncorrectQuestionListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: post killer exam grading API 요청 함수 //
export const postKillerExamGradingRequest = async (requestBody: PostKillerExamGradingRequestDto, accessToken: string) => {
    const responseBody = await api.post(POST_KILLER_EXAM_GRADING_URL, requestBody, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<PostExamResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: post past exam grading API 요청 함수 //
export const postPastExamGradingRequest = async (requestBody: PostPastExamGradingRequestDto, accessToken: string) => {
    const responseBody = await api.post(POST_PAST_EXAM_GRADING_URL, requestBody, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<PostExamResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: post mock exam grading API 요청 함수 //
export const postMockExamGradingRequest = async (requestBody: PostMockExamGradingRequestDto, accessToken: string) => {
    const responseBody = await api.post(POST_MOCK_EXAM_GRADING_URL, requestBody, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<PostExamResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: post incorrect question grading API 요청 함수 //
export const postIncorrectQuestionGradingReuqest = async (requestBody: PostIncorrectQuestionGradingRequestDto, accessToken: string) => {
    const responseBody = await api.post(POST_INCORRECT_QUESTION_GRADING_URL, requestBody, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<PostExamResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: get exam result list API 요청 함수 //
export const getExamResultListRequest = async (accessToken: string, groupId: number, filter: string) => {
    const responseBody = await api.get(GET_EXAM_RESULT_LIST_URL(groupId, filter), bearerAuthorization(accessToken))
        .then(responseSuccessHandler<GetExamResultListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: patch user password API 요청 함수 //
export const patchUserPasswordRequest = async (requestBody: PatchUserPasswordRequestDto, accessToken: string) => {
    const responseBody = await api.patch(PATCH_USER_PASSWORD_URL, requestBody, bearerAuthorization(accessToken))
        .then(responseSuccessHandler)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: get learning record list API 요청 함수 //
export const getLearningRecordListRequest = async (accessToken: string) => {
    const responseBody = await api.get(GET_LEARNING_RECORD_LIST_URL, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<GetLearningRecordListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
}

// function: get unit grading result list API 요청 함수 //
export const getUnitGradingResultListRequest = async (accessToken: string, groupId: number) => {
    const responseBody = await api.get(GET_UNIT_GRADING_RESULT_LIST_URL(groupId), bearerAuthorization(accessToken))
        .then(responseSuccessHandler<GetUnitGradingResultListResponseDto>)
        .catch(responseErrorHandler);
    return responseBody;
};

// function: 수정한 문제 JSON과 모든 이미지를 한 번에 등록하는 API 요청 함수 //
export const postAdminQuestionsRequest = async (requestBody: PostQuestionsRequestDto, images: File[], accessToken: string): Promise<ResponseDto | null> => {
    const formData = new FormData();
    formData.append('jsonFile', new File([JSON.stringify(requestBody)], 'questions.json', { type: 'application/json' }));
    images.forEach(image => formData.append('images', image));

    // multipart boundary는 브라우저/Axios가 지정하며 기존 인증 및 재발급 인스턴스를 재사용합니다.
    return api.post(POST_ADMIN_QUESTIONS_URL, formData, bearerAuthorization(accessToken))
        .then(responseSuccessHandler<ResponseDto>)
        .catch((error: AxiosError<{ code?: string; message?: string; detail?: string }>) => {
            if (!error.response) return null;
            const { data, status } = error.response;
            return {
                code: data?.code || `HTTP_${status}`,
                message: data?.message || data?.detail || (status === 403
                    ? '관리자 권한이 필요합니다.'
                    : `문제 등록에 실패했습니다. (HTTP ${status})`)
            };
        });
};

// function: 기존 인증 인스턴스로 서버의 관리자 접근 허용 여부 확인 //
export const getAdminCheckRequest = async (accessToken: string): Promise<number | null> => {
    return api.get<ResponseDto>(GET_ADMIN_CHECK_URL, { ...bearerAuthorization(accessToken), timeout: 15000 })
        // 프록시의 HTML 200 등은 관리자 확인 성공으로 처리하지 않습니다.
        .then(response => response.status === 200 && response.data?.code === 'SU' ? 200 : null)
        .catch((error: AxiosError<ResponseDto>) => error.response?.status ?? null);
};

// function: 관리자 문제 목록 조회 — 기존 인증/재발급 인스턴스 재사용 //
export const getAdminQuestionsRequest = async (filter: QuestionListFilter, page: number, accessToken: string) => {
    let data: unknown;
    try {
        const response = await api.get(`${API_DOMAIN}/api/admin/questions`, {
            ...bearerAuthorization(accessToken), params: { ...filter, page, size: 20 }
        });
        data = response.data;
    } catch (error) {
        const response = (error as AxiosError<{ message?: string; detail?: string }>).response;
        throw new Error(response?.data?.message || response?.data?.detail || (response?.status === 403
            ? '관리자 권한이 필요합니다.' : '문제 목록을 불러오지 못했습니다. 연결 상태를 확인하고 다시 조회해주세요.'));
    }
    return parseAdminQuestionPage(data);
};

// function: 관리자 회원 목록/학습 현황 조회 — 기존 Axios 인증·재발급 경로 재사용 //
const adminMemberError = (error: unknown, action: string): Error => {
    const response = (error as AxiosError<{ message?: string; detail?: string }>).response;
    const status = response?.status;
    const fallback = status === 400 ? '검색 조건을 확인해주세요.'
        : status === 401 ? '로그인이 만료되었습니다. 다시 로그인해주세요.'
        : status === 403 ? '관리자 권한이 필요합니다.'
        : status === 404 ? '회원을 찾을 수 없습니다.'
        : status === 500 ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        : `${action}에 실패했습니다. 연결 상태를 확인해주세요.`;
    return new Error(response?.data?.message || response?.data?.detail || fallback);
};

export const getAdminMembersRequest = async (keyword: string, page: number, accessToken: string) => {
    try {
        const response = await api.get(GET_ADMIN_USERS_URL, {
            ...bearerAuthorization(accessToken),
            params: { ...(keyword.trim() ? { keyword: keyword.trim() } : {}), page, size: 20 }
        });
        return parseAdminMemberPage(response.data);
    } catch (error) {
        if (error instanceof Error && !axios.isAxiosError(error)) throw error;
        throw adminMemberError(error, '회원 목록 조회');
    }
};

export const getAdminMemberLearningSummaryRequest = async (userId: string, accessToken: string) => {
    try {
        const response = await api.get(`${GET_ADMIN_USERS_URL}/${encodeURIComponent(userId)}/learning-summary`,
            bearerAuthorization(accessToken));
        return parseAdminMemberLearningDetail(response.data);
    } catch (error) {
        if (error instanceof Error && !axios.isAxiosError(error)) throw error;
        throw adminMemberError(error, '회원 학습 현황 조회');
    }
};

// function: 단일 관리자 문제 상세/수정/삭제 — 기존 Axios 인증·재발급 경로 재사용 //
const adminQuestionUrl = (questionId: number) => `${POST_ADMIN_QUESTIONS_URL}/${questionId}`;

const adminQuestionError = (error: unknown, action: string): Error => {
    const response = (error as AxiosError<{ message?: string; detail?: string }>).response;
    const status = response?.status;
    const fallback = status === 400 ? '입력값을 확인해주세요.'
        : status === 403 ? '관리자 권한이 필요합니다.'
        : status === 404 ? '문제를 찾을 수 없습니다.'
        : status === 409 ? '학습 기록 등에서 사용 중인 문제이거나 변경이 충돌하여 처리할 수 없습니다.'
        : status === 500 ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        : `${action}에 실패했습니다. 연결 상태를 확인해주세요.`;
    return new Error(response?.data?.message || response?.data?.detail || fallback);
};

export const getAdminQuestionDetailRequest = async (
    questionId: number,
    pastExamRound: number | null,
    accessToken: string
) => {
    try {
        const response = await api.get(adminQuestionUrl(questionId), {
            ...bearerAuthorization(accessToken),
            ...(pastExamRound === null ? {} : { params: { pastExamRound } })
        });
        return parseAdminQuestionDetail(response.data);
    } catch (error) {
        if (error instanceof Error && !axios.isAxiosError(error)) throw error;
        throw adminQuestionError(error, '문제 상세 조회');
    }
};

export const putAdminQuestionRequest = async (questionId: number, question: PutAdminQuestionRequestDto,
    questionImage: File | null, explanationImage: File | null, accessToken: string): Promise<ResponseDto> => {
    const data = new FormData();
    data.append('question', new Blob([JSON.stringify(question)], { type: 'application/json' }));
    if (questionImage) data.append('questionImage', questionImage);
    if (explanationImage) data.append('explanationImage', explanationImage);
    try {
        // Content-Type을 지정하지 않아 브라우저가 multipart boundary를 설정합니다.
        const response = await api.put<ResponseDto>(adminQuestionUrl(questionId), data, bearerAuthorization(accessToken));
        if (response.data?.code !== 'SU') throw new Error(response.data?.message || '문제 수정 결과를 확인하지 못했습니다.');
        return response.data;
    } catch (error) { throw axios.isAxiosError(error) ? adminQuestionError(error, '문제 수정') : error; }
};

export const deleteAdminQuestionRequest = async (questionId: number, accessToken: string): Promise<ResponseDto> => {
    try {
        const response = await api.delete<ResponseDto>(adminQuestionUrl(questionId), bearerAuthorization(accessToken));
        if (response.data?.code !== 'SU') throw new Error(response.data?.message || '문제 삭제 결과를 확인하지 못했습니다.');
        return response.data;
    } catch (error) { throw axios.isAxiosError(error) ? adminQuestionError(error, '문제 삭제') : error; }
};
