# Ark Lens

로스트아크 캐릭터 조회 웹앱입니다. Vite, React 18, TypeScript, React Router와 TanStack Query를 사용합니다.

Node.js 22.12 이상에서 실행합니다.

```sh
npm ci
npm run dev
npm run build
npm test
npx tsc --noEmit
npm run lint
```

운영에서는 사용자가 발급한 키를 브라우저에서 등록합니다. 앱은 키를 선택한 브라우저 저장소에 평문으로 보관하고, API 요청의 Authorization 헤더에 담아 로스트아크 Open API로 전송합니다. 공유 가능한 캐릭터 주소는 해시 경로 `#/c/캐릭터이름`을 사용합니다.

[Cloudflare 배포 가이드](docs/deploy-cloudflare.md)에서 정적 Pages 배포와 사용자 동의 후에만 사용하는 선택형 Worker 프록시 설정을 안내합니다.

## API 호출 없이 데모 보기

Vite 개발 서버에서 다음 주소를 엽니다. 포트가 바뀌면 서버가 표시한 주소를 사용하세요.

- 키 등록 화면 `http://localhost:5173/?demo=1&setup=1#/settings/key`
- 캐릭터 `http://localhost:5173/?demo=1#/c/은하수바리케이드`
- 상태 화면 `http://localhost:5173/?demo=1#/c/서버점검`
- 검색어 `없는캐릭터`, `키오류`, `호출제한`, `연결오류`, `서버오류`로 각각의 오류를 볼 수 있습니다.

[가상 픽스처](fixtures/README.md)의 데이터는 목업에서 가져왔습니다. Tooltip 구조는 CHARACTERS·ARMORIES 상세 가이드 §4의 타입별 구조를 참고해 합성했습니다. 검증 흐름을 데모에서 시험하려면 `demo.fixture.sample`을 입력하세요. 데모 전송과 자격 증명은 브라우저 메모리 안에서만 처리되며 운영 빌드에는 데모 픽스처가 들어가지 않습니다. API 테스트는 MSW를 사용합니다.

## 키로 확인할 것

- 정상 키에서 200 응답과 CORS 헤더, 429 및 503 응답에서 오류 상태를 읽을 수 있는지 확인
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`의 브라우저 노출 여부와 Reset 단위 확인
- 존재하지 않는 캐릭터의 404, 200 + null 또는 프로필 누락 응답 확인
- 필터의 리터럴 `+` 구분자와 누락 섹션의 형태 확인
- 프로필 이미지 및 아이콘 CDN 호스트를 확인하고 CSP에 반영
- 현재 버전의 Tooltip에서 장신구 중·하 색상, 팔찌 복합 옵션, 스톤 세공 및 상급 재련 추출 검증

선택 범위인 프록시는 v1에서 제외했습니다. 장신구 중·하 등급은 색상 매핑이 확인되기 전까지 Tooltip에 등급이 명시된 경우에만 표시합니다.

[UI 설계](docs/ui-design.md) · [정적 목업](docs/mockup/index.html) · [구현 화면](docs/screens)
