# 모꼬꼬로아 Cloudflare 배포

## Pages 배포

1. Cloudflare 계정을 만들고 대시보드에서 **Workers & Pages**에 접근할 수 있는지 확인합니다. 로컬에 Node.js 22.12 이상과 npm을 준비합니다.
2. 저장소 루트에서 의존성을 설치하고 Wrangler에 로그인합니다. 브라우저에서 배포할 계정으로 승인합니다.

   ```sh
   npm ci
   npx wrangler login
   ```

3. Direct Upload 방식으로 Pages 프로젝트를 만듭니다. 예시는 프로덕션 브랜치 이름이 `main`인 경우입니다. 프로젝트 이름을 바꾸면 루트 `wrangler.toml`의 `name`도 같은 값으로 수정합니다. [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

   ```sh
   npx wrangler pages project create mokokoloa --production-branch main
   ```

   Wrangler 4.168은 AI 코딩 에이전트가 실행했다고 판단하면 새 Pages 프로젝트 생성·배포를 Workers 정적 자산 배포로 넘깁니다. 에이전트나 자동화 도구에서 실행해 위임 안내가 나오면 `--force`를 붙여 Pages 프로젝트로 만듭니다. 프로젝트가 생긴 뒤의 명령에는 `--force`가 필요 없습니다.

   ```sh
   npx wrangler pages project create mokokoloa --production-branch main --force
   ```

4. 빌드한 뒤 `dist`를 배포합니다. `--branch`는 위에서 지정한 프로덕션 브랜치와 일치시킵니다. Wrangler가 계정을 선택하라고 하면 프로젝트를 만든 계정을 선택합니다.

   ```sh
   npm run build
   npx wrangler pages deploy dist --project-name mokokoloa --branch main
   ```

   bash 같은 POSIX 셸에서는 `npm run deploy -- --branch main`으로 같은 일을 할 수 있습니다. Windows PowerShell 5.1에서는 `npm`이 PowerShell 스크립트로 실행되면서 `--`가 사라지고 `--branch`가 npm 옵션으로 해석되므로, 위처럼 Wrangler를 직접 실행합니다.

5. 출력된 프로덕션 URL을 열고 `/#/settings/key`에서 새로고침합니다. 키 등록 화면이 정상적으로 표시되는지 확인합니다. `HashRouter`는 URL의 `#` 뒤를 브라우저에서 처리합니다. 최상위 `404.html` 없이 Pages의 기본 SPA 설정을 사용하며 빌드 자산은 루트에서 로드합니다. [Cloudflare Pages SPA 동작](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering)

빌드가 `index.html`의 메타 CSP에서 정책을 읽어 `dist/_headers`에도 동일하게 적용합니다. 배포 후 브라우저 개발자 도구의 문서 응답에서 CSP와 `Referrer-Policy: no-referrer`를 확인할 수 있습니다. [Cloudflare Pages 사용자 정의 헤더](https://developers.cloudflare.com/pages/configuration/headers/)

## 기존 주소 이전

새 앱을 `https://mokokoloa.pages.dev`에 먼저 배포하고 키 등록 화면과 해시 경로가 열리는지 확인합니다. 프록시를 사용할 경우 아래 Worker 배포와 새 앱 연결까지 마친 뒤, 기존 `ark-lens` 프로젝트에 리다이렉트 전용 정적 파일을 배포합니다.

```sh
npx wrangler pages deploy redirect/ark-lens --project-name ark-lens --branch main
```

`--project-name`이 루트 `wrangler.toml`의 `name`보다 우선합니다. POSIX 셸에서는 `npm run deploy:redirect -- --branch main`도 같습니다.

기존 주소의 루트는 HTML 리다이렉트에서 쿼리와 해시를 유지합니다. 직접 경로는 Pages의 301로 새 도메인의 `/_from-ark-lens/` 경로를 거치고, 새 앱은 원래 경로와 함께 `from=ark-lens`를 표시합니다. 원래 쿼리를 유지하기 위해 301 규칙의 목적지에는 쿼리를 넣지 않습니다. [Cloudflare Pages 리다이렉트](https://developers.cloudflare.com/pages/configuration/redirects/)

브라우저 저장소는 주소별로 분리되므로 기존 도메인에 저장한 API 키는 새 도메인에서 다시 등록해야 합니다. 같은 주소에서 앱을 업데이트하면 기존 `arklens.*` 값을 읽을 때 `mokokoloa.*`로 옮깁니다.

## 선택 사항 · Worker 프록시 연결

별도 Worker를 사용합니다. Pages Functions는 같은 origin을 쓸 수 있지만, 이 구성에서는 프록시 없이 정적 Pages만 배포할 수 있고, 프록시를 켠 뒤에도 두 서비스를 독립적으로 배포하고 롤백할 수 있습니다.

1. `proxy/wrangler.toml`의 `ALLOWED_ORIGIN`을 실제 Pages 프로덕션 origin으로 변경합니다. 예를 들어 `https://mokokoloa.pages.dev`입니다. 경로와 끝 슬래시 없이 기입합니다. 로컬 개발에서만 추가로 연결하려면 `LOCAL_DEV_ORIGIN` 주석을 풀고 실제 개발 주소 하나를 지정합니다. 다른 `pages.dev` 주소와 프리뷰 주소에서의 호출은 기본 설정에서 거부됩니다.
2. 처음 Workers를 사용한다면 대시보드의 **Workers & Pages**에서 `workers.dev` 하위 도메인을 설정합니다. 저장소 루트에서 배포합니다.

   ```sh
   npx wrangler deploy --config proxy/wrangler.toml
   ```

3. 출력된 Worker origin을 저장소 루트의 `.env.production.local`에 넣고 Pages를 다시 배포합니다. 이 변수는 브라우저 번들과 CSP에 포함되는 공개 URL입니다. Direct Upload에서는 로컬 빌드가 값을 읽습니다.

   ```dotenv
   VITE_PROXY_URL=https://mokokoloa-proxy.YOUR_SUBDOMAIN.workers.dev
   ```

   ```sh
   npm run build
   npx wrangler pages deploy dist --project-name mokokoloa --branch main
   ```

4. 앱은 직접 호출로 시작합니다. 연결 오류가 발생하면 **프록시로 재시도**가 표시됩니다. 확인창에서 Worker origin을 확인하고 동의하면 열린 페이지에서 프록시를 사용합니다. **프록시 끄기** 또는 새로고침으로 직접 호출로 돌아갑니다. 프록시 옵션을 배포에서 제거하려면 `VITE_PROXY_URL`을 지우고 다시 빌드·배포합니다.

각 사용자는 자신의 브라우저에서 API 키를 등록합니다. Cloudflare 환경변수에는 API 키를 넣을 필요가 없습니다. Worker는 허용한 경로의 요청 키를 인증 헤더로 옮기고, 응답의 호출 한도 헤더를 브라우저에서 읽을 수 있게 전달합니다. 응답 캐시와 Worker 관측 로그는 사용하지 않습니다.

로컬에서 프록시를 연결할 때는 `LOCAL_DEV_ORIGIN`을 Vite가 표시하는 주소와 일치시키고, `.env.development.local`에 `VITE_PROXY_URL`을 설정합니다. 로컬 Worker는 `npx wrangler dev --config proxy/wrangler.toml`로 시작할 수 있으며, 이 경우 `VITE_PROXY_URL` 예시는 `http://localhost:8787`입니다.

## 선택 사항 · 사용자 정의 도메인

Pages 프로젝트에서 **Custom domains → Set up a domain**으로 도메인을 먼저 추가합니다. 루트 도메인은 같은 Cloudflare 계정의 영역과 Cloudflare 네임서버가 필요합니다. 외부 DNS의 하위 도메인은 요청된 CNAME을 프로젝트의 `pages.dev` 호스트로 지정합니다. 도메인이 활성화되면 HTTPS로 열리는지 확인합니다. 프록시를 사용한다면 `ALLOWED_ORIGIN`도 최종 도메인으로 변경한 뒤 Worker를 다시 배포합니다. [Cloudflare Pages 사용자 정의 도메인](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## 무료 플랜 한도

2026-11-25 기준 Cloudflare 공식 문서에서 확인했습니다.

| 서비스 | 적용 한도 |
| --- | --- |
| Pages | Cloudflare 빌드 월 500회, 계정당 동시 빌드 1개, 빌드 제한 시간 20분. 이 배포 절차는 로컬에서 빌드합니다. 사이트당 파일 20,000개 및 파일당 25 MiB, 프로젝트당 사용자 정의 도메인 100개. [Pages 한도](https://developers.cloudflare.com/pages/platform/limits/) |
| Pages 정적 요청 | 무료 정적 자산 요청에 요청 수 한도가 없습니다. [Pages Functions 요금](https://developers.cloudflare.com/pages/functions/pricing/) |
| Workers | 계정당 일 100,000 요청, 호출당 CPU 10ms 및 하위 요청 50회. Worker로 들어오는 CORS 사전 요청도 요청량에 포함해 계산합니다. [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/) |

## 롤백

- **Pages** 프로젝트의 **Deployments → All deployments**에서 정상 동작했던 프로덕션 배포의 **⋯ → Rollback to this deployment**를 선택합니다. 프리뷰와 삭제된 배포는 대상에서 제외됩니다. 배포 보존 기간은 기본 30일이며 최근 100개와 현재 프로덕션 배포는 보존됩니다. [Pages 롤백](https://developers.cloudflare.com/pages/configuration/rollbacks/) · [배포 보존 한도](https://developers.cloudflare.com/pages/platform/limits/#deployments)
- **Worker**의 **Deployments**에서 이전 버전의 **⋯ → Rollback**을 선택하거나, 저장소 루트에서 `npx wrangler rollback VERSION_ID --config proxy/wrangler.toml`을 실행합니다. 롤백 후 Pages 빌드에 포함된 Worker 주소와 Worker 버전의 `ALLOWED_ORIGIN`이 실제 도메인 구성과 맞는지 확인합니다. [Workers 롤백](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
