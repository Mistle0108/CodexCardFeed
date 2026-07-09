# CodexCardFeed

Codex에서 쌓이는 대화를 그냥 흘려보내지 않고, 다시 찾고 분류하고 관리할 수 있는 로컬 브라우저입니다.

Codex로 작업하다 보면 많은 토큰을 써서 만든 결과물이 그 순간에는 유용하지만, 시간이 지나면 다시 찾기 어렵고 같은 질문을 반복하게 됩니다. CodexCardFeed는 이 문제를 줄이기 위해 Codex의 로컬 세션 데이터를 프로젝트, 스레드, 턴 단위로 정리하고 카드형 UI로 다시 탐색할 수 있게 만듭니다.

현재 상태는 개인 로컬 환경에서 실사용 가능한 v1입니다.

## 왜 만들었는가

Codex 대화는 다음 특성이 있습니다.

- 토큰을 써서 만든 결과물이 많다.
- 그 결과물 안에는 문제 해결 과정, 판단 근거, 재사용 가능한 질문과 답변이 들어 있다.
- 하지만 시간이 지나면 다시 찾기 어렵다.
- 결국 비슷한 질문을 반복하고, 이미 만든 결과물을 다시 생산하게 된다.

이 프로젝트의 목적은 버려지기 쉬운 Codex 결과물을 다시 검색 가능한 자료로 끌어올리는 것입니다.

## 이 프로젝트가 하는 일

CodexCardFeed는 Codex의 로컬 세션 로그를 읽어서 필요한 메타데이터를 추출하고, 이를 로컬 SQLite 데이터베이스에 정리합니다. 사용자는 Electron 기반 UI에서 프로젝트, 채팅, 스레드, 턴을 빠르게 탐색하고, 태그/핀/메모 같은 로컬 관리 정보를 덧붙여 자신만의 대화 아카이브를 만들 수 있습니다.

원본 Codex 데이터는 직접 수정하지 않습니다. 원본은 그대로 두고, 이 프로그램 안에서만 별도의 로컬 관리 데이터를 저장합니다.

## 현재 제공 기능

- Codex 세션 import
- 프로젝트 / Historical / Chats 구분 표시
- 스레드 목록 탐색과 선택
- 턴 카드 목록 탐색
- 질문만 모아보는 질문 모드
- 턴 상세 모달
- 로컬 메타데이터 관리
  - 제목 수정
  - 태그 추가/삭제
  - 핀
  - 메모
- 사이드바 범위 검색
  - 프로젝트명
  - 스레드명
  - 태그
- 선택된 스레드 내부 검색
  - 질문
  - 최종 답변
  - 태그
  - 메모
- Diagnostics
  - Data check
  - Session diagnosis
- 백업 내보내기 / 다시 열기
- Codex 원본 스레드 열기

`Open in Codex`는 현재 스레드 단위까지 연결됩니다. 특정 턴으로 직접 이동시키는 기능은 포함하지 않습니다.

## 데이터 모델

### Project

Codex에서 하나의 작업 맥락으로 묶이는 상위 단위입니다. 여러 스레드를 포함할 수 있습니다.

### Thread

하나의 대화 세션입니다. 사이드바에서 선택하는 일반적인 채팅 단위에 해당합니다.

### Turn

한 번의 사용자 질문과 그에 이어진 작업, 최종 답변을 묶는 단위입니다. 이 앱에서 카드의 기본 단위로 사용됩니다.

### Item

턴 내부에 저장된 개별 기록 단위입니다. 사용자 메시지, 진행 메시지, 최종 답변, reasoning, tool/web search 기록 등이 여기에 포함됩니다.

## 현재 구조

### Renderer

- `src/renderer/components`
  - 사이드바, 워크스페이스, 상세 모달 등 UI 컴포넌트
- `src/renderer/hooks`
  - 선택 상태, 검색 상태, 메타데이터 편집 상태, 유지보수 액션 분리
- `src/renderer/styles`
  - `base`, `sidebar`, `workspace`, `detail`, `diagnostics`, `modal`, `responsive` 영역별 스타일 분리

### Electron / Main

- `electron/main.js`
  - 윈도우 생성, IPC 연결, Codex 열기, 경로 관리
- `electron/preload.js`
  - renderer에 노출하는 제한된 브리지
- `electron/ipc.js`
  - IPC 핸들러 등록
- `electron/db.js`
  - SQLite 스키마와 조회/저장 API
- `electron/importer/`
  - Codex 로그 파싱, 병합, 검증, 저장
- `electron/integrity.js`
  - 데이터 무결성 점검
- `electron/background-tasks.js`
  - import / diagnosis 백그라운드 작업 실행

## 성능과 품질 상태

최근 리밸런싱으로 다음이 반영되어 있습니다.

- renderer 파생 계산 메모이제이션
- 검색 입력에 대한 deferred 처리
- `listTurnsByThread` 조회 쿼리 경량화
- importer / db / background task 테스트 유지

현재 기준으로 기능 검증용 MVP를 넘어서, 로컬 개인 사용 목적에는 충분히 실사용 가능한 상태입니다.

## 실행 방법

### 설치

```bash
npm install
```

### 개발 실행

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

## 검증 명령

```bash
npm run typecheck
npm test
```

## 저장 데이터와 참조 경로

기본적으로 다음 두 종류의 데이터를 사용합니다.

- Codex 원본 세션 경로
  - 예: `C:\Users\<user>\.codex`
- CodexCardFeed 로컬 데이터베이스
  - 예: `C:\Users\<user>\AppData\Roaming\Electron\codex-card-feed.sqlite`

앱 내 `Paths` 패널에서 현재 참조 경로를 확인하고 변경할 수 있습니다.

## 이 프로젝트의 방향

CodexCardFeed는 새로운 AI 결과를 생성하는 도구가 아니라, 이미 생산된 Codex 대화를 다시 자료화하는 도구입니다.

핵심 가치는 다음 세 가지입니다.

- 종합: 흩어진 대화를 한 곳에 모은다.
- 분류: 프로젝트, 스레드, 턴 단위로 다시 구조화한다.
- 관리: 태그, 핀, 메모, 제목 수정으로 나만의 기준으로 재사용 가능하게 만든다.
