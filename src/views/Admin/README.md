# 관리자 문제 일괄 등록

경로: `/admin/upload`. `/admin` 및 모든 관리자 하위 화면은 `AdminRoute`로 보호합니다. 기존 `index.jsx`는 TypeScript 구현 `AdminPage.tsx`를 내보내는 진입점입니다.

## 편집 및 등록 흐름

1. JSON의 `questions` 배열을 파싱하여 `QuestionDraft[]` 상태에 보관합니다. 기출 회차는 `number | null`로 관리하며, 나머지 숫자 입력은 기존 편집 방식을 유지합니다.
2. 이미지 상태는 `{ file, previewUrl }[]`이며 원래 파일명으로 문제/해설과 연결합니다. 선택·편집 시 네트워크 요청은 없습니다.
3. 각 문제 카드에서 편집하면 시험 형태의 미리보기도 즉시 갱신됩니다. 접기/펼치기와 유형 필터를 지원합니다.
4. **문제 등록** 버튼에서 모든 문제를 검증합니다. 필터로 숨겨진 문제도 포함합니다.
5. 최신 상태를 정확한 DTO의 `{ questions: [...] }`로 변환합니다. 기존 Axios 인스턴스로 새 `questions.json` 파일을 `jsonFile`에, 모든 선택 이미지를 `images`에 넣어 `POST /api/admin/questions`로 한 번에 전송합니다.
6. 실패 시 편집 내용과 이미지를 유지합니다. 성공 시 중복 등록을 막고 **새 등록 시작**으로 초기화할 수 있습니다.

이미지를 삭제할 때 참조 문제를 확인한 후 연결을 해제합니다. Object URL은 개별 삭제·초기화·화면 종료 시 해제합니다. JSON 재선택은 기존 문제 교체를 확인하며 잘못된 JSON은 기존 편집 내용을 지우지 않습니다.

## 서버 계약

- 문제 유형은 정확히 `모의고사` / `기출문제`입니다.
- 지문과 선택지는 서버 DTO 제한에 따라 각 255자 이하입니다.
- 기출문제는 `pastExamRound`, `questionOrder`가 필요합니다.
- 모의고사 `tags`는 쉼표로 구분한 중복 없는 양의 정수입니다.
- 상세 해설은 `null` 또는 내용/이미지 중 하나 이상 있는 객체입니다.
- 이미지는 PNG/JPG/JPEG/WEBP, 파일당 10MB 이하입니다. 실제 이미지 시그니처는 서버가 최종 검증합니다.
- 섹션의 DB 존재 여부와 관리자 권한은 서버가 검증합니다. 기출 회차는 서버가 조회하고 없으면 자동 생성합니다.
- 성공 응답은 201, `{ code: "SU", message: "Success." }`로 개수나 생성 ID가 없어 이를 성공 결과에 추정하여 표시하지 않습니다.

기존 Axios JWT/CSRF 재발급 처리와 Vercel Rewrite는 그대로 사용합니다. 서버가 상세 예외 대신 `Server error.`만 반환하는 경우 프론트엔드도 확인된 메시지만 표시합니다.

이번 변경은 일괄 등록 화면에 한정합니다. 문제 목록 메뉴는 현재 편집 데이터를 보여주는 기존 프론트엔드 범위이며 DB 조회 목록이 아닙니다. 승인번호 화면은 `POST /api/v1/auth/approval-code`에 `{ phoneNumber }`를 전송하며 숫자 11자리 검증, 발송 중 중복 요청 방지, 성공/오류 표시를 지원합니다.

검증 방법은 `postman/README.md`를 참고하세요.

## 관리자 접근 확인

- `Layout`이 기존 CSRF 쿠키 및 refresh API로 로그인 복구를 완료한 후 `AdminRoute`를 렌더링합니다.
- `GET /api/admin/check`를 기존 Axios 인스턴스로 호출하고 HTTP 200 + `SU` 성공 응답일 때 관리자 화면을 렌더링합니다.
- 확인 중에는 로딩 화면, 403이면 접근 차단, 최종 401이면 로그인 화면을 표시합니다. 네트워크/서버 오류와 404는 접근을 허용하지 않으며 재확인을 제공합니다.
- 일반 서비스 헤더의 관리자 메뉴도 같은 서버 확인을 통과한 경우에만 표시합니다. 메뉴에서 관리자 화면에 진입할 때는 다시 확인합니다.
- 확인 결과는 hook의 React 상태에만 있으며 JWT를 해석하거나 역할을 로컬 저장소에 저장하지 않습니다. 토큰이 변경되면 이전 확인 결과는 즉시 사용하지 않습니다.
- 실제 권한은 Spring Security가 매 요청 검증합니다. 배포 환경에는 `AdminController`의 check API가 먼저 반영되어 있어야 합니다.

기출문제 등록은 숫자 `pastExamRound`를 사용합니다. 기존 `pastExamId`는 읽거나 전송하지 않으며, 예전 JSON에 ID만 있으면 회차 입력란을 비우고 실제 회차 입력을 안내합니다. JSON의 회차가 문자열이면 형식 오류를 표시합니다.

이미지 연결은 JSON과 이미지 선택 순서에 관계없이 다시 계산합니다. JSON을 읽는 중에도 이미지를 추가할 수 있습니다. 한글 파일명의 조합 방식(NFC/NFD)과 JSON 파일명의 앞뒤 공백 차이를 맞춰 비교한 뒤, 실제 선택한 원본 파일명을 React 상태와 전송 JSON에 반영합니다. 같은 이름으로 해석되는 이미지의 중복 추가는 차단합니다. 서로 다른 파일명은 자동 추측하지 않으며 문제별 이미지 선택 목록에서 직접 연결할 수 있습니다.

## 등록된 문제 조회

`/admin/questions`의 문제 목록 메뉴는 `QuestionList.tsx`를 표시합니다. JSON 편집 상태와 독립된 조회 화면입니다.

- `GET /api/admin/questions`: 기출은 `questionType`, `pastExamRound`, 모의는 `questionType`, `difficulty`. 공통 `page`는 0부터 시작하며 `size=20`입니다.
- 로컬 백엔드의 `AdminQuestionController`, `GetAdminQuestionListResponseDto`, `AdminQuestionListItemDto`를 확인해 연결했습니다. 응답은 `code: SU`, `questions`, `totalElements`, `totalPages`, `page`, `size`, `last`입니다.
- 서버 저장소는 기출을 `questionOrder ASC, pastExamQuestionId ASC`, 모의를 `questionId DESC`로 정렬합니다. 클라이언트는 서버 페이지 순서를 유지합니다.
- DTO 검증은 `src/apis/dto/response/admin/question-list.ts`에 분리했습니다. 응답 규격 변경 시 해당 경계를 수정하며, 미확인 응답을 빈 목록으로 처리하지 않습니다. 배포 서버의 계약 일치는 별도 확인이 필요합니다.
- React 상태로 입력 조건, 조회에 사용한 조건, 페이지 응답, 로딩/오류를 관리합니다. 조건 변경 시 이전 결과를 비웁니다.
- 기존 Axios 인증/재발급 및 AdminRoute를 재사용합니다. 상세·수정·삭제는 아래 API 계약을 따릅니다.

### 목록 레이아웃 및 회차 선택

- 기존 `getPastExamRoundListRequest` (`GET /api/v1/past-exam`)의 `pastExamRounds`에서 실제 `pastExamRound`를 선택합니다. 내부 `pastExamId`는 목록 조회에 전달하지 않습니다.
- 회차 로딩/빈 목록/실패를 구분하고 실패 시 재시도할 수 있습니다. 임의 회차 입력은 제공하지 않습니다.
- 조건 카드와 결과 카드를 분리하고 목록 전용 최대 너비, 모바일 테이블 가로 스크롤, 두 줄 지문 말줄임, 이미지 배지를 적용했습니다.

## 단일 문제 상세·수정·삭제

- `GET /api/admin/questions/{questionId}`: `GetAdminQuestionDetailResponseDto`를 받아 편집창을 표시합니다.
- `PUT /api/admin/questions/{questionId}`: `multipart/form-data`의 JSON 파트 `question`, 선택한 파일 파트 `questionImage`·`explanationImage`를 전송합니다. JSON은 `PutAdminQuestionRequestDto`의 필드만 담습니다. 이미지 유지 시 파트를 생략하고 삭제 시 각각 `deleteQuestionImage`·`deleteExplanationImage`를 지정합니다. 브라우저가 multipart boundary를 설정하도록 Content-Type은 직접 지정하지 않습니다.
- `DELETE /api/admin/questions/{questionId}`: 목록 또는 상세의 확인창에서 실행합니다. 409 등 서버 메시지를 표시하고, 성공 시 현재 목록을 다시 조회합니다.
- 기존 DB 이미지 URL이 `/api/...`면 개발 API 주소 또는 Vercel 프록시를 사용합니다. 과거 `localhost` 절대 URL도 현재 `/api` 경로로 변환합니다. 새 파일 미리보기 Object URL은 교체·닫기 시 해제합니다.
- 백엔드 수정 DTO에는 `questionType` 필드가 없어 현재 문제 유형은 읽기 전용입니다. 입력값 검증 후 서버가 DB 참조 및 이미지 파일 내용을 최종 검증합니다.
