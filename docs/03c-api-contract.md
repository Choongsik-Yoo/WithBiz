# WithBiz AI API 계약

작성일: 2026-10-27 · STEP 3 설계 명세 · API 미구현

## 공통 계약

기본 경로는 `/api/v1`이다. JSON을 사용하고 ID는 UUID, 업무 날짜는 `YYYY-MM-DD`, 시각은 UTC offset을 포함하는 ISO 8601이다. 화면은 Asia/Seoul로 변환한다. 원문·첨부 URL에는 공급자 인증키를 포함하지 않는다.

성공 응답은 data와 meta를 갖는다. meta는 requestId, dataMode(sample/live), asOf, sourceCoverage, 필요한 경우 catalogVersion을 포함한다. 목록은 추가로 nextCursor와 hasMore를 반환한다. AI 상태와 데이터 출처 상태는 값이 없는 이유를 구분할 수 있게 별도 필드로 표현한다.

| 오류 HTTP | code 예시 | 동작 |
| --- | --- | --- |
| 400 | INVALID_INPUT, INVALID_CURSOR | 잘못된 필드별 설명, 검색·정렬 유지 |
| 401 | AUTH_REQUIRED | 로그인 후 안전한 원래 경로로 복귀 |
| 403 | FORBIDDEN | 관리자 권한 없음 등. 다른 사용자의 정보 노출 없음 |
| 404 | NOT_FOUND | 없거나 접근할 수 없는 개별 리소스 |
| 409 | VERSION_CONFLICT, CURSOR_STALE | 최신값 재조회, 입력 보존 |
| 429 | RATE_LIMITED | Retry-After와 재시도 가능 시각 |
| 503 | CONNECTION_REQUIRED, PROVIDER_UNAVAILABLE | 설정·작업 상태를 표시. 샘플로 몰래 전환하지 않음 |

오류 본문은 error.code, error.message, error.fields(입력 오류일 때), meta.requestId로 구성한다. 스택·SQL·키·공급자 원문 URL query는 제외한다. GET은 부작용을 만들지 않는다. 회원 변경 요청은 Origin·세션을 검증하고 입력 필드 allowlist를 적용한다. 관리자·내부 API는 각각 별도 인증을 적용한다.

## 공개 조회

| 메서드·경로 | 입력 | 출력·주의 |
| --- | --- | --- |
| GET /dashboard/summary | category, region, field | 진행 중·이번 주 마감·창업·기업 지표, 지역·분야 분포, 출처별 기준일·상태 |
| GET /announcements | q, category, region, field, agency, status, sort, limit, cursor | 공고 카드 목록. limit 기본20/최대50. 숨김 제외 |
| GET /announcements/deadline-this-week | category, region, field, limit, cursor | 한국 주간 범위 중 아직 마감하지 않은 공고. 기본20/최대50 |
| GET /announcements/{id} | id | 대표 공고, 모든 공개 출처, 현재 AI 요약·추출 조건, 첨부 확인 상태 |
| GET /metadata | 없음 | 지역·분야·유형 코드, 데이터 모드, 인증·AI·메일 기능 상태 |

category 코드는 startup/business/rnd/investment/small_business다. field와 region은 코드표에서 검증한다. status는 upcoming/open/closing/closed/unknown이다. deadline_kind는 fixed/open/budget_exhausted/unknown으로 별도 표시한다. ‘전체’는 필터 생략으로 표현한다. 잘못된 코드를 전체로 조용히 바꾸지 않는다.

여러 분야·지역 필터는 동일 차원 안에서는 OR, 다른 차원 간에는 AND로 결합한다. 실제 전국 공통 공고는 지역 선택 시 기본 포함하며 includeNationwide=false로 제외할 수 있다. 지역 미확인은 별도 옵션이고 전국 공통으로 포함하지 않는다. dashboard와 마감 목록도 같은 규칙을 따른다.

검색 q는 trim 후 최대100자, 제어 문자 불가다. DB에 문자열 SQL을 이어붙이지 않고 파라미터를 바인딩한다. 마감순은 apply_end_at/날짜 종료 기준 오름차순과 id로 정렬하고 미확정 마감은 마지막이다. 최신순은 원천 등록일 내림차순과 id 내림차순이며, 원천 등록일이 없으면 최초 수집일을 쓴다. 수정일을 등록일로 둔갑시키지 않는다.

커서는 정렬값·id·필터 해시·catalogVersion·한국 기준일을 담는 불투명 값이다. 모든 항목을 검증하고 다른 필터에 재사용하면 400을 반환한다. 공고 변경으로 catalogVersion이 달라지거나 기준일이 바뀌면 409 CURSOR_STALE로 첫 페이지 갱신을 안내한다. 여러 요청 사이의 DB 스냅샷이 보장된 것처럼 설명하지 않는다.

이번 주는 월요일 00:00 KST부터 다음 월요일 전까지다. 진행 중은 접수중+마감임박이다. 대시보드의 ‘이번 주 마감’은 이미 종료한 공고를 제외한다. 캘린더는 기록 확인을 위해 지난 마감도 표시한다. 조회수나 금액을 지원금으로 오해해 카드에 표시하지 않는다.

## 회원과 기업

| 메서드·경로 | 입력 | 출력·권한 |
| --- | --- | --- |
| GET /me | 세션 | 내 이름, 주 기업, 서버 확인 역할, 동의 문서 버전 |
| PATCH /me | name | 내 표시 이름만 수정. role 입력 불가 |
| POST /consents | consentType, documentVersion, accepted | 본인 동의·철회 기록 |
| GET /companies | 세션 | 내 기업 목록 |
| POST /companies | 기업 입력 | 202, 기업 데이터·profileVersion·matchJobId |
| GET /companies/{id} | id | 본인 기업과 완성도·재매칭 상태 |
| PATCH /companies/{id} | 기업 수정, expectedVersion | 202, 저장된 기업·새 버전·matchJobId. 충돌409 |
| DELETE /companies/{id} | id, expectedVersion | 204, 본인 기업과 관련 추천·임베딩·작업 삭제/취소 |
| GET /companies/{id}/recommendations | limit, cursor, includeExcluded | 본인 기업 추천. 점수·근거·버전·처리 상태·다음 갱신 상태 |
| GET /announcements/{id}/fit | company | 현재 저장된 적합도 또는 pending/unavailable. 새 AI 호출 없음 |
| GET /jobs/{id} | id | 본인이 요청한 작업의 상태·완료 수·안전한 오류 코드 |

기업 입력: name(1~100자), bizType, size, ksicCodes(검증 코드 배열), sido, sigungu, foundedOn, revenueBand, employees(0 이상 정수), ownerTraits, certifications, interests, needs. 선택값은 null 또는 빈 배열로 구분한다. ownerId·profileVersion·role·score는 서버가 관리하며 입력을 받지 않는다.

추천 응답에는 resultStatus, score(null 허용), eligibilityStatus, reasons[], checks[], generatedAt, companyVersion, announcementRevision, algorithmVersion을 포함한다. 최신 프로필과 결과 버전이 다르면 stale=true와 진행 작업을 반환한다. excluded 사유는 해당 기업 소유자만 볼 수 있다. 샘플 점수는 dataMode=sample로 표시한다.

로그인·이메일 확인·비밀번호 복구·구글 OAuth는 Supabase Auth SDK와 서버 콜백으로 처리한다. 자체 비밀번호 API를 만들지 않는다. returnTo는 같은 출처의 허용된 상대 경로만 허용한다. 카카오 로그인은 2차다.

## 관심·캘린더·알림

| 메서드·경로 | 입력 | 출력·동작 |
| --- | --- | --- |
| GET /bookmarks | limit, cursor | 본인 관심과 메모. 숨김 공고는 제목·내용 없이 unavailable 표시 |
| POST /bookmarks | announcementId, memo | 201 신규 저장. 기존 관심이면200으로 같은 행 반환 |
| PATCH /bookmarks/{announcementId} | memo, expectedUpdatedAt | 메모 수정. 동시 수정409 |
| DELETE /bookmarks/{announcementId} | 없음 | 204, 이미 없어도 성공. 미발송 알림 대상 제외 |
| GET /calendar | month 또는 from/to, view | month=YYYY-MM, view=month/week. 본인 관심 마감과 미확정 목록 |
| GET /notification-settings | 세션 | 이메일·마감 시점·주간 요약·변경 알림 설정 |
| PUT /notification-settings | emailEnabled, deadlineOffsets, weeklyEnabled, changeEnabled | 전체 설정 대체. 공급자 미연결이면 저장 가능하나 deliveryStatus=connection_required |
| GET /notifications | limit, cursor | 본인 발송 이력. 발송 여부 불명확 상태를 구분 |

캘린더 from/to는 동시에 필요하고 한국 날짜 기준 최대62일 범위다. 종료 경계는 다음 날 00:00 미만으로 일관되게 적용한다. 날짜 없는 상시 공고는 특정 날짜에 임의 배치하지 않는다. 알림 시간대는 MVP에서 Asia/Seoul로 고정한다.

## 관리자와 시스템

| 메서드·경로 | 권한·입력 | 출력·동작 |
| --- | --- | --- |
| GET /admin/collection-runs | 관리자, source/status/date/limit/cursor | 소스별 실행·건수·안전한 오류 |
| GET /admin/summary | 관리자 | 사용자·기업 수, 실행 상태, AI 사용량 집계. 개인 프로필 전체 미노출 |
| POST /admin/sources/{id}/recollect | 관리자, Idempotency-Key | 202 jobId. 미설정 공급자는503. 진행 중 동일 작업은 재사용 |
| PATCH /admin/announcements/{id} | 관리자, expectedRevision, 허용 수정값, reason | 공개여부·검수된 정규화 값 수정. 원본 보존·감사·매칭 갱신 |
| GET /admin/jobs | 관리자, state/kind/cursor | 실패·차단 작업과 처리 상태 |
| POST /admin/jobs/{id}/retry | 관리자, Idempotency-Key | 202. 인증키 오류·설정 누락은 해결 전 blocked 상태 유지 |
| POST /internal/jobs/{name} | 서명, timestamp, nonce, body | 수집·매칭·알림 작업 접수 또는 제한된 작업 처리 |
| POST /webhooks/email | 공급자 서명 | 중복 event ID 제외, 발송 상태 조정 |

관리자는 검증된 로그인과 private.user_roles의 현재 role을 함께 확인한다. 수정 허용 필드는 title·agency·operator·fields·regions·regionEstimated·신청기간·deadlineKind·visibility이며 내부ID·소유자·원본payload는 받지 않는다. 지원 조건을 바꾸는 수정은 새 revision과 검수 근거를 남긴다.

시스템 서명은 METHOD·경로·timestamp·nonce·body 해시에 대한 HMAC-SHA256 설계다. 최대5분 시간차와 nonce 재사용을 차단하고 일정시간 비교를 사용한다. 비밀값을 URL에 넣지 않는다. nonce 저장소는 private 테이블로 별도 마이그레이션에 추가한다. 브라우저와 일반 회원에게 내부 작업 인증을 제공하지 않는다.

## 입력·권한·오류 검증 계획

- 모든 경로의 입력·출력 Zod 계약과 프론트 타입을 공유한다.
- 본인이 아닌 기업·작업·관심 ID, 미로그인·일반 회원의 관리자 요청을 검사한다.
- 잘못된 커서·페이지 끝·빈 검색·미확정 날짜·접수 종료 시각을 검증한다.
- 성공 HTTP 내부 업무 오류, 타임아웃, 연결 미설정, 부분 실패를 구분한다.
- 개인 응답의 캐시 분리와 중복 저장·재실행의 멱등성을 확인한다.

구현 시 이 명세에서 OpenAPI 계약을 생성한다. 현재는 실행 가능한 API나 자동 생성된 SDK가 존재하지 않는다.
