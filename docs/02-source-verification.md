# WithBiz AI 데이터 소스 검증 보고서

검증일: 2026-10-27 (KST) · STEP 2 · 상태: 기업마당·중기부 인증 조회 확인, K-Startup 후속 연결

진행 결정: 사용자가 “api는 추후 연결하고 게속 진행해줘”라고 지시하여 API 연결을 개발 진행의 선행 조건에서 제외했다. 아래 실패·미검증 사실은 유지하고 STEP 3 설계를 진행한다. API 연결 보류는 검증 성공을 의미하지 않는다.

## 결론

3개 API 경로의 공식 문서·엔드포인트·무인증 응답을 확인한 뒤, 사용자가 제공한 키로 인증 조회를 수행했다. 기업마당은 실제 공고 4건, 두 페이지, 빈 검색 결과, 원문 페이지를 확인했다. 사용자가 일반 인증키를 교체한 후 중기부도 실제 공고 4건과 빈 결과 조회에 성공했다. K-Startup은 여전히 HTTP 403과 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`(30)를 반환한다. 사용자는 두 공공데이터 서비스 활용신청이 모두 승인되었다고 확인했다.

키는 프로젝트 `.env.local`에 저장했으며 `.gitignore` 적용과 Git 미추적 상태를 확인했다. 보고서·증거 파일에는 키를 기록하지 않았다. 다른 프로젝트나 계정의 비밀키는 검색하지 않았다. STEP 2 전체 통과로 판단하지 않는다.

중기부 지정 API는 기업마당 데이터를 제공한다. 따라서 계획의 3개 경로는 독립적인 3개 데이터 원천이 아니다. 두 기업마당 경로의 공고 ID와 내용 중첩을 인증 후 비교하고, 주 경로·예비 경로로 구성하는 방안을 STEP 3에 제안한다. 원래 요구사항을 임의로 축소하거나 수집 성공 기준을 변경한 것은 아니다.

## 공식 소스 검증표

| 항목 | 중기부 지원사업 | 기업마당 직접 API | K-Startup |
| --- | --- | --- | --- |
| 공식 문서 | [공공데이터포털 15157820](https://www.data.go.kr/data/15157820/openapi.do) | [지원사업 API 안내](https://www.bizinfo.go.kr/apiDetail.do?id=bizinfoApi) | [공공데이터포털 15125364](https://www.data.go.kr/data/15125364/openapi.do) |
| GET 주소 | `https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService` | `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do` | `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01` |
| 인증 인자 | `serviceKey` | `crtfcKey` | `serviceKey` |
| JSON 선택 | `dataType=json` | `dataType=json` | `returnType=json` |
| 페이지 인자 | `pageNo`, `numOfRows` | `pageIndex`, `pageUnit`, `searchCnt` | `page`, `perPage` |
| 문서상 트래픽 | 개발계정 10,000 | 공개 안내에서 호출 한도 미확인 | 개발계정 10,000 |
| 승인 | 개발 자동 / 운영 심의 | 별도 사용 신청 후 인증키 발급 | 개발·운영 자동 |
| 실제 무인증 응답 | HTTP 401, `SERVICE_KEY_IS_NULL` | HTTP 200, `reqErr` | HTTP 401, `SERVICE_KEY_IS_NULL` |
| 인증 후 수집 | 새 일반 인증키로 성공 | 성공, 실제 공고 조회 | 403, 등록되지 않은 서비스키(30) |

포털의 10,000 표기를 초당 한도로 해석하지 않는다. 계정별 실제 할당량·주기·초당 제한·운영 증설은 활용신청 화면에서 추가 확인한다. 직접 API의 `searchCnt=0` 또는 생략은 문서상 전체 조회이므로 초기 검증에서 사용하지 않는다.

## 실제 요청과 응답

이 절의 최초 요청은 인증키 없이 수행했다. 이후 인증 조회 결과는 다음 절에 별도로 기록했다. 샘플 공고를 생성하거나 오류를 성공으로 대체하지 않았다.

| 요청 | HTTP | 본문 핵심 |
| --- | --- | --- |
| 중기부 `?pageNo=1&numOfRows=1&dataType=json` | 401 | `OpenAPI_ServiceResponse.cmmMsgHeader.errMsg=SERVICE_KEY_IS_NULL`, `returnReasonCode=20` |
| 기업마당 `?dataType=json&searchCnt=1&pageUnit=1&pageIndex=1` | 200 | `{"reqErr":"인증키를 입력해주세요."}` |
| K-Startup `?page=1&perPage=1&returnType=json` | 401 | `OpenAPI_ServiceResponse.cmmMsgHeader.errMsg=SERVICE_KEY_IS_NULL`, `returnReasonCode=20` |

기업마당 응답의 Date 헤더는 `Tue, 27 Oct 2026 01:47:08 GMT`였다. 이는 한국 시각 10:47:08이다. 나머지 두 응답의 개별 시각은 보존하지 않아 날짜만 기록한다.

초기 중기부 진단 요청에는 `type=json`을 사용했으나 공식 명세 확인 후 `dataType=json`으로 수정하여 재검증했다. K-Startup도 `returnType=json`으로 최종 재검증했다. 표는 수정 후 결과다.

인증 오류는 재시도로 해결하지 않는다. 추후 수집기는 HTTP 상태뿐 아니라 본문의 업무 오류를 검사해야 한다. 위 결과는 주소에 접근 가능하고 인증이 필요하다는 증거이며, 성공 응답 구조·데이터 품질·유효 키의 권한을 증명하지 않는다.

## 인증 조회 결과와 증거

기업마당 검증은 2026-10-27 10:55 KST, 새 일반 인증키의 중기부·K-Startup 검증은11:47 KST 기준이다. 인증키는 query 기록에서 제외했다. 검증용 PowerShell 도구는 `docs/verification/verify-source.ps1`에 있으며 운영 수집기 코드는 아니다.

| 검증 | 결과 | 증거 |
| --- | --- | --- |
| 기업마당 1페이지 | HTTP 200, `jsonArray` 2건, `totCnt=1420` | [조회 결과](evidence/bizinfo-page1.json) |
| 기업마당 2페이지 | HTTP 200, 다른 ID 2건. 총 4건의 ID 모두 고유 | [조회 결과](evidence/bizinfo-page2.json) |
| 기업마당 빈 검색 | HTTP 200, `{"jsonArray":[]}` | [빈 결과](evidence/bizinfo-empty.json) |
| 기업마당 원문 | HTTP 200, 공고 ID·제목 일치 | [링크 검증](evidence/bizinfo-links.json) |
| 기업마당 첨부 2개 | HEAD 403, GET 500. 첨부 내용을 읽지 못함 | [GET 검증](evidence/bizinfo-attachment-get.json) |
| 중기부 인증 | HTTP 200, 두 페이지 각2건·총건수1,420 | [검증 기록](evidence/mss-verification.json) |
| 중기부 빈 검색 | HTTP 200, `resultCode=03`, `NODATA_ERROR`, 총0건 | [빈 결과](evidence/mss-empty.json) |
| K-Startup 인증 | HTTP 403, 동일 오류·코드 | [오류 기록](evidence/kstartup-verification.json) |

기업마당의 최초 전달 값은 인증 오류였으며 사용자가 교체한 뒤 조회가 성공했다. 이전 값은 보존하지 않는다. 성공 샘플은 ‘화성시 2026년 2차 스마트 물류비 지원사업 참가기업 모집 연장 공고’다. 1페이지 ID는 `PBLN_000000000127470`, `PBLN_000000000127469`, 2페이지는 `PBLN_000000000127468`, `PBLN_000000000127467`이다. 총 1,420건은 당시 API 응답의 전체 건수이며 전체 공고를 다운로드한 것은 아니다.

기업마당 페이지 요청은 `searchCnt=4&pageUnit=2&pageIndex=1` 및 `pageIndex=2`로 수행했다. 빈 검색에는 충돌 가능성이 낮은 테스트 해시태그를 사용했다. 중기부는 `dataType=json&numOfRows=2&pageNo=1`과2페이지를 조회했다. 중기부 빈 결과는 존재하지 않는 pblancId로 요청했으며 코드03·총0건을 정상적인 빈 결과로 분류한다. 실제 원본 응답은 그대로 보존했다. 최종 페이지·전체 기간 포괄성·삭제 감지·장기간 수집 안정성은 미검증이다.

두 기업마당 경로에서 확인한4개 공고 ID와 같은 ID의 제목·신청기간·원문 링크가 모두 일치했다. [표본 대조 기록](evidence/cross-source-comparison.json)을 보관했다. 이4건 표본의 ID 중첩100%를 전체 데이터의 중복률이나 전체 동일성으로 일반화하지 않는다. 사용자가 보는 대표 공고와 출처별 레코드를 분리하는 설계의 근거로 사용한다.

샘플 공고의 신청기간은 2026-10-01~2026-10-30, 원본 수정일은 2026-10-26이다. 제목에 연장이 명시된 공고를 확인했지만, 변경 전후 응답을 비교한 이력 검증은 아직 아니다. 첨부 GET은 헤더를 먼저 읽고 중단하도록 하여 전체 파일 다운로드를 수행하지 않았다. 500 응답의 원인은 확인되지 않았으며, 모든 첨부가 실패한다고 일반화하지 않는다. UI에서는 원문 링크를 제공하고 첨부 처리 실패 상태를 표시해야 한다.

## 공공데이터 인증 오류 조사

사용자 확인: 두 서비스 모두 활용신청 승인됨. 첫 공공데이터 키는 두 서비스에서 등록되지 않은 키 오류였다. 교체한 일반 인증키는 중기부에서 정상 동작하고 K-Startup에서만 동일 오류가 지속된다. 따라서 현재 키 자체가 모든 서비스에서 무효라고 판단하지 않는다. 요청에는 공식 명세의 소문자 `serviceKey`를 사용했고 키를 브라우저나 공개 검색 도구에 전달하지 않았다.

[공공데이터포털 공식 에러코드 안내](https://www.data.go.kr/tcs/dss/selectErrCodePopupView.do)는 코드 30에 대해 인증키 정확성과 활용신청 완료 여부를 확인하도록 설명한다. [경상남도 공식 FAQ](https://bigdata.gyeongnam.go.kr/board/list.gn?boardId=BBS_0000003&categoryCode1=PUB&contentsSid=339&menuCd=DOM_000000111005000000)는 승인·키 발급 이후 기관 서버 동기화에 약 1시간이 걸릴 수 있다고 안내한다. 이는 가능한 원인이지 이번 오류의 확정 원인이나 복구 시간 보장은 아니다.

현재 값은 URL 예약문자가 없는 형태여서 URL 인코딩 전후가 동일함을 로컬에서 확인한다. 인증 오류를 해결하기 위한 무의미한 연속 요청이나 임의 키 변형은 수행하지 않는다. K-Startup 후속 확인은 승인된 데이터셋 ID15125364와 실제 신청 서비스의 일치, 동기화 상태, 포털 미리보기 호출 결과다. 필요한 경우 이 보고서의 키가 제거된 요청·응답을 문의 자료로 활용할 수 있다. 문의 발송은 수행하지 않았다. 이 확인 때문에 설계·구현 준비를 멈추지 않는다.

## 공통 필드 매핑 초안

중기부·기업마당 열은 인증 성공 JSON으로 확인했다. K-Startup 열은 공식 문서와 내장 Swagger 기준으로 실제 데이터가 미검증이다. 기업마당 공개 안내의 RSS 예시와 달리 실제 JSON은 `jsonArray` 배열이며 제목·ID 등의 이름이 다르다. 중기부는 `response.body.items.item` 배열이다.

| 공통 항목 | 중기부 | 기업마당 문서 item | K-Startup |
| --- | --- | --- | --- |
| 외부 ID | `pblancId` | `pblancId` | `pbanc_sn` |
| 제목 | `pblancNm` | `pblancNm` | `biz_pbanc_nm` |
| 원문 후보 | `pblancUrl` | `pblancUrl` | `biz_aply_url` |
| 소관·지원기관 | `jrsdInsttNm` | `jrsdInsttNm` | `pbanc_ntrp_nm` |
| 수행·주관기관 | `excInsttNm` | `excInsttNm` | `sprv_inst` |
| 설명 | `bsnsSumryCn` | `bsnsSumryCn` (HTML 포함) | `pbanc_ctnt` |
| 분야 | `pldirSportRealmLclasCodeNm` | `pldirSportRealmLclasCodeNm` | `supt_biz_clsfc` |
| 신청기간 | `reqstBeginEndDe` | `reqstBeginEndDe` | `pbanc_rcpt_bgng_dt`, `pbanc_rcpt_end_dt` |
| 지원대상 | `trgetNm` | `trgetNm` | `aply_trgt`, `aply_trgt_ctnt` |
| 지역 | 해시태그·본문 판단 | `hashtags`·본문 판단 | `supt_regin` |
| 등록·수정 | `creatPnttm`, `updtPnttm` | `creatPnttm`, `updtPnttm` | 미확인 |
| 첨부 | `flpthNm`, `fileNm` | `flpthNm`, `fileNm`, `printFlpthNm`, `printFileNm` (누락 가능) | 이번 명세에서 첨부 필드 미확인 |
| 모집 상태 | 기간 등으로 산정 | 기간 등으로 산정 | `rcrt_prgs_yn` 참고 |

K-Startup 명세는 `biz_aply_url`을 공고 상세, `detl_pg_url`을 사업 신청 URL로 설명한다. 이름만 보고 반대로 연결하지 않는다. 인증 응답의 실제 링크를 열어 용도를 확인한 후 확정한다. 명세에는 신청 제외 조건 `aply_excl_trgt_ctnt`도 있어 자격 추출 입력에 포함할 수 있다.

## 수집 설계에 반영할 발견 사항

1. 동일 공고는 경로별 수집 이력과 사용자에게 보이는 공고를 구분한다. 마감일이 변경되어 중복 해시가 달라져도 기존 외부 ID로 갱신해야 한다. 서로 다른 차수의 공고를 유사 제목만으로 합치지 않는다.
2. 기업마당의 지역 태그에는 `전남광주`처럼 결합된 값이 있다. 단일 시도로 치환하지 않고 지원대상으로 확인한다. 전국·지역 미확인을 분리한다.
3. K-Startup 모집 상태의 문서상 기본값은 모집중이다. 마감·연장·재개 공고를 놓치지 않도록 모집중/마감 조회와 기존 레코드 재확인 전략을 인증 후 검증한다.
4. 문자열 날짜·상시모집·예산 소진·빈 날짜는 별도 보존한다. 정확한 종료 시각을 임의 생성하지 않는다.
5. 공고 상세와 신청 링크를 분리한다. 첨부 접근은 크기·형식·다운로드 응답·허용 호스트를 확인하고 그 후 AI 처리 여부를 정한다.

## 이용 조건 확인 사항

중기부 포털은 공공누리 제3유형(출처표시·변경금지)을 표시한다. K-Startup 포털은 이용허락범위 제한 없음으로 표시한다. 이는 페이지에 표시된 조건의 기록이며 개별 첨부나 AI 요약의 허용 범위에 대한 법적 결론이 아니다. 중기부·기업마당 데이터의 요약·재가공·임베딩 활용 범위는 제공기관 확인 사항으로 남긴다. 직접 API와 포털 경로의 조건이 동일하다고 가정하지 않는다.

## 남은 인증 검증 절차

1. 공공데이터포털 두 서비스는 사용자 확인상 승인됨. 기업마당·중기부 조회는 성공했다. K-Startup의 실제 승인 서비스·데이터셋과 인증 정보 동기화 상태를 추가 확인한다.
2. 키는 로컬 `.env.local`의 `MSS_API_KEY`, `KSTARTUP_API_KEY`, `BIZINFO_API_KEY`에 설정했다. 파일은 Git 제외 상태다. 값은 보고서나 로그에 표시하지 않는다.
3. 기업마당·중기부는 두 페이지·빈 결과를 확인했다. K-Startup은 인증 해결 후 성공 envelope·필드 타입·페이지 종료 조건을 검증한다. 비밀키를 제거한 응답만 검증 자료로 저장한다.
4. 현재 모집·마감·변경 공고를 대조하고 원문·첨부 링크를 확인한다. 두 기업마당 경로의 공고 ID 중복률과 내용 차이를 측정한다.
5. 호출 한도는 승인 화면과 문서로 확인한다. 부하를 발생시켜 한도를 시험하지 않는다.
6. 실패·0건·잘못된 키·중복 실행 시 처리 기준을 정리하고 소스 검증 완료 여부를 판정한다.

인증 전 대안은 공식 문서 기반 매핑을 유지하고 연결 완료로 표시하지 않는 것이다. API 자체의 장애나 폐지는 입증되지 않았으므로 웹 스크래핑으로 전환하지 않는다. 향후 수집 대안이 필요하면 별도로 약관·robots.txt를 검토한다.

## 다음 단계 참고자료

원본 마스터 문서의 하이퍼링크 관계에서 실제 주소를 확인했다.

- WithBid AI: https://choongsik-yoo.github.io/widbid/
- 지원사업 지도: https://biz-support-map.vercel.app/

이 단계에서는 디자인 토큰을 추출하거나 승인하지 않았다. STEP 3에서 실제 화면을 확인한다.

## 상태 보고

- 구현 완료: STEP 2 검증 문서 갱신, 검증 도구·비밀키 제외 설정·실제 응답 증거 저장. 앱 구현 코드는 미작성.
- 테스트 완료: 기업마당·중기부 인증 조회 각4건, 페이지 구분·빈 결과·표본 ID 중첩 확인. 기업마당 원문 일치, K-Startup 인증 오류와 기업마당 샘플 첨부 오류를 확인했다. 실패도 실제 결과로 기록했다.
- 미구현·보류: K-Startup 인증과 실제 데이터, 첨부 처리, 전체 소스 간 중복률, 수집 범위·할당량 검증. 사용자의 후속 지시에 따라 미연결 항목은 후속 처리하고 STEP 3 설계를 진행한다.
