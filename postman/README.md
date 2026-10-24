# 관리자 접근 및 문제 등록 로컬 HTTP 검증

실제 Spring Boot `AdminController`, `WebSecurityConfig`, `AdminQuestionController`, `AdminQuestionDto`, `AdminQuestionService`, `ResponseDto`에서 확인한 계약을 기준으로 만든 로컬 테스트 대역입니다. 실제 DB에 저장하지 않으며 서버의 DB·파일 저장·권한 검증을 대신 검증하지 않습니다. 팀에서 배포한 mock 대신 이 저장소와 함께 제공된 백엔드 소스를 사용했습니다.

```sh
postman simulation run postman/simulations/admin-questions.sim.yaml --port 4910 --output ndjson --no-history
```

다른 터미널에서:

```sh
ADMIN_HTTP_TEST_URL=http://127.0.0.1:4910/backend CI=true npm test -- --watchAll=false --runInBand --testPathPattern='registration-http|access-http'
```

종료:

```sh
pkill -INT -f 'simulation run postman/simulations/admin-questions.sim.yaml'
```

Postman CLI 1.70 이상이 필요합니다. 로컬 전용이며 클라우드에 업로드하거나 배포할 필요가 없습니다. 일반 `npm test`에서는 HTTP 테스트 11개를 건너뜁니다.

- `GET /api/admin/check`의 200·403·401 응답, 서버 오류, 미배포 404 및 프록시 HTML 응답을 검증합니다.
- 토큰 재발급 후 다시 401이면 요청을 종료하는지 확인합니다.
- 실제 Axios XHR 클라이언트로 `POST /api/admin/questions`를 호출합니다.
- `jsonFile`에 수정된 `{ questions: [...] }` JSON, `images`에 이미지들을 반복 첨부합니다.
- 이미지 없는 요청, 서버 오류 표시, 빈 403 응답 처리, 401 이후 기존 CSRF/토큰 재발급과 multipart 재전송을 확인합니다.
- 테스트 전용 토큰으로 응답을 선택합니다. `/__test/requests`는 전송 내용 검증용 로컬 경로이며 실제 프론트엔드 API로 사용하지 않습니다.
- 실제 운영 자격증명이나 문제 데이터를 이 mock으로 전송하지 마세요.

UI 및 검증 로직 테스트:

```sh
CI=true npm test -- --watchAll=false --runInBand --testPathPattern=views/Admin
```

## 킬러문제 새 출제 회귀 검증

```sh
ADMIN_HTTP_TEST_URL=http://127.0.0.1:4910/backend CI=true npm test -- --watchAll=false --runInBand --testPathPattern=killer-http
```

실제 Main/Exam 컴포넌트와 Axios를 실행해 저장된 문제가 있어도 시작 버튼을 누를 때마다 `GET /api/v1/killer-exam`을 호출하는지 확인합니다. 두 번 시작, 오류 후 재시도, 잘못된 저장 데이터의 영향을 검증합니다. 테스트 서버는 요청마다 다른 고정 예시 문제를 반환하므로 이 테스트는 재요청을 검증하며 실제 서버의 무작위 추출 품질을 검증하지 않습니다. 메인 화면의 단원/기출 회차 목록만 테스트 안에서 대체합니다.

## 승인번호 발송 회귀 검증

```sh
ADMIN_HTTP_TEST_URL=http://127.0.0.1:4910/backend CI=true npm test -- --watchAll=false --runInBand --testPathPattern=approval-http
```

`AuthController.approvalCode`와 `ApprovalCodeRequestDto`의 계약을 사용합니다. 관리자 폼과 실제 Axios로 `POST /api/v1/auth/approval-code`에 `{ "phoneNumber": "01022222222" }`를 보내는지, 입력 검증·중복 요청 방지·201 성공 및 SMS 발송 실패 안내를 확인합니다. 실제 SMS는 전송하지 않습니다.
