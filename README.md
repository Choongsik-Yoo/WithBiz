# WithBiz AI

정부지원사업 공고 통합 조회와 기업 맞춤 추천 웹앱 개발 프로젝트다.

실행 앱: https://choongsik-yoo.github.io/WithBiz/

Next.js 정적 앱 + GitHub Pages + Supabase 인증/DB 구조로 구현했다. Node.js 24에서 `npm ci`, `npm run dev`로 실행한다. `npm run typecheck`, `npm test`, `npm run build`로 검증한다. Pages 빌드는 `NEXT_PUBLIC_BASE_PATH=/WithBiz`를 설정하며 출력은 `apps/web/out`이다.

공고 검색·필터·상세·지도·관심/메모·달력·기업 프로필·조건 기반 추천·알림 설정 저장을 제공한다. 공식 MSS 공고 1,420건을 초기 저장했다. `.github/workflows`에서 테스트/배포와 매일 한국 시간 06:00 수집을 수행한다. 비밀키는 GitHub 암호화 Secrets로 주입한다.

AI 요약·점수·벡터 후보 단계와 이메일 발송은 후속 연결이다. 가상 AI 점수나 발송 성공 기록을 생성하지 않는다. 선택형 매칭 배치는 키와 모델 설정 시 규칙 후보 상위 20건을 재평가한다. `npm run collect`는 비공개 `.env.local`을 사용한다.

자세한 구현·검증·제한은 [구현 기록](docs/04-implementation.md)을 참고한다. 이전 설계 이미지의 공고와 수치는 예시다.

## 문서

- [개발구조와 화면 설계 검토안](docs/03-design-review.md)
- [요구사항](docs/01-PRD.md)
- [데이터 소스 실제 검증](docs/02-source-verification.md)

기업마당과 중기부 API는 인증된 표본 조회를 확인했다. K-Startup은 인증 오류를 기록했고 연결을 보류했다. 실제 API 표본·검증 기록과 설계용 예시 이미지는 구분한다.

환경 파일 `.env.local`은 Git 제외 대상이다. 키를 공개 문서·앱 클라이언트·로그에 포함하지 않는다. 현재 검증 도구는 루트 환경 파일을 읽으며 이후 모노레포 실행·배포에서는 각 실행 환경에 변수를 명시적으로 연결한다.

## 정적 화면 설계

- [데스크톱 대시보드](docs/design/wireframes/dashboard-desktop.png)
- [모바일 대시보드](docs/design/wireframes/dashboard-mobile.png)
- [공고 상세](docs/design/wireframes/announcement-detail.png)

이 그림의 수치·공고·AI 결과는 모두 예시이며 실제 실행 기능을 제공하지 않는다.
