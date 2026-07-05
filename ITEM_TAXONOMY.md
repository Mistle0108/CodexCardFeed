# CodexCardFeed Item Taxonomy

## 목적

Codex 원본 세션 로그는 내부 trace 형태로 저장되고, 공식 문서는 공개 개념 수준의 taxonomy를 설명한다.
이 문서는 두 층을 분리해서 관리하기 위한 기준이다.

- 원본 보존층: Codex가 남긴 `kind`, `role`, `raw_json`
- 정규화층: 앱이 UI, 검색, 필터링, 통계에 쓰는 안정 분류

이 구조를 쓰면 Codex 내부 포맷이 바뀌어도 importer 매핑만 고치면 된다.

## 원칙

1. 원본 `raw_json`과 원본 `kind`는 항상 보존한다.
2. UI와 검색은 가능하면 정규화된 분류를 기준으로 동작한다.
3. 공식 문서에 있는 개념을 상위 taxonomy로 쓴다.
4. 공식 문서에 없는 내부 `kind`는 정규화 매핑층에서 흡수한다.
5. 새 `kind`가 생기면 우선 원본 저장 후 `unknown`으로 분류하고, 이후 매핑을 추가한다.

## 공식 taxonomy

Codex Manual 기준으로 공개적으로 설명되는 item 범주는 다음과 같다.

출처:

- https://developers.openai.com/codex/codex-manual
- `codex exec --json` 설명: `agent messages`, `reasoning`, `command executions`, `file changes`, `MCP tool calls`, `web searches`, `plan updates`

| normalized_kind | 의미 | 공식 개념 |
|---|---|---|
| `user_input` | 실제 사용자가 보낸 입력 | thread input |
| `agent_message` | 어시스턴트가 사용자에게 보여주는 텍스트 메시지 | agent messages |
| `reasoning` | 모델 내부 추론 흔적 | reasoning |
| `command_execution` | 로컬 명령/도구 실행과 결과 | command executions |
| `file_change` | 파일 수정 작업 | file changes |
| `mcp_tool_call` | MCP/외부 도구 호출과 결과 | MCP tool calls |
| `web_search` | 검색, 페이지 열기, 페이지 내 검색 | web searches |
| `plan_update` | 계획 갱신 | plan updates |
| `image_generation` | 이미지 생성/편집 요청 | image generation |
| `injected_context` | 시스템/개발자/런타임이 주입한 컨텍스트 | 공식 taxonomy 바깥, 앱 전용 보조 분류 |
| `unknown` | 아직 정규화되지 않은 새 item | fallback |

## 현재 DB 관측 kind 매핑

다음 표는 현재 `items.kind`에 실제로 들어오는 값을 정규화 taxonomy에 매핑한 것이다.

| role | raw kind | normalized_kind | normalized_subtype | UI 기본 처리 |
|---|---|---|---|---|
| `user` | `message` | `user_input` | `message` | 카드 `Q` 후보 |
| `assistant` | `message:commentary` | `agent_message` | `commentary` | 중간 진행 메시지 |
| `assistant` | `message:final_answer` | `agent_message` | `final_answer` | 카드 `A` 1순위 |
| `assistant` | `message` | `agent_message` | `message` | fallback 메시지 |
| `assistant` | `web_search_call` | `web_search` | `search/open_page/find_in_page` | 중간 작업 |
| `assistant` | `function_call` | `command_execution` | tool name 기준 세분화 | 중간 작업 |
| `tool` | `function_call_output` | `command_execution` | tool output | 중간 작업 결과 |
| `assistant` | `custom_tool_call` | `file_change` | `apply_patch` 등 | 중간 작업 |
| `tool` | `custom_tool_call_output` | `file_change` | patch result | 중간 작업 결과 |
| `assistant` | `tool_search_call` | `mcp_tool_call` | `tool_search` | 중간 작업 |
| `tool` | `tool_search_output` | `mcp_tool_call` | `tool_search_output` | 중간 작업 결과 |
| `assistant` | `image_generation_call` | `image_generation` | `generate/edit` | 중간 작업 |
| `developer` | `message` | `injected_context` | `developer_message` | 기본 숨김 |

## 세부 subtype 기준

### agent_message

| raw kind | normalized_subtype | 설명 |
|---|---|---|
| `message:commentary` | `commentary` | 작업 중간 안내 |
| `message:final_answer` | `final_answer` | 최종 답변 |
| `message` | `message` | phase 없는 일반 메시지 |

### web_search

`web_search_call.raw_json.action.type` 기준으로 세분화한다.

| action.type | normalized_subtype | 설명 |
|---|---|---|
| `search` | `search` | 검색 실행 |
| `open_page` | `open_page` | 검색 결과나 URL 열기 |
| `find_in_page` | `find_in_page` | 열린 페이지 내 문자열 검색 |
| 없음/기타 | `unknown` | 신규 형태 |

### command_execution

`function_call.raw_json.name` 기준으로 세분화한다.

예시:

- `exec_command`
- `write_stdin`
- `read_thread_terminal`
- `load_workspace_dependencies`
- `view_image`
- `update_plan`
- `request_user_input`
- `list_threads`
- `create_thread`

주의:

- 공식 taxonomy상 모두 `command_execution` 또는 넓은 의미의 tool execution으로 본다.
- UI에서는 tool name을 그대로 보여주되, 상위 분류는 `command_execution`으로 묶는다.

### file_change

현재 관측상 거의 전부 `apply_patch`다.

| raw kind | normalized_subtype | 설명 |
|---|---|---|
| `custom_tool_call` + `name=apply_patch` | `apply_patch` | 패치 적용 요청 |
| `custom_tool_call_output` | `apply_patch_output` | 패치 적용 결과 |

### mcp_tool_call

현재 관측상 `tool_search_call`, `tool_search_output`이 있다.
향후 앱 커넥터, MCP 서버 도구 호출도 같은 상위 분류에 넣는다.

| raw kind | normalized_subtype | 설명 |
|---|---|---|
| `tool_search_call` | `tool_search` | 툴 검색 |
| `tool_search_output` | `tool_search_output` | 툴 검색 결과 |

### image_generation

| raw kind | normalized_subtype | 설명 |
|---|---|---|
| `image_generation_call` | `generation` | 이미지 생성/편집 요청 |

### injected_context

| role | raw kind | normalized_subtype | 설명 |
|---|---|---|---|
| `developer` | `message` | `developer_message` | permissions, app-context, skills, plugins, collaboration mode 등 |

## 턴 구성 규칙

앱에서 턴은 다음 순서로 이해한다.

1. 실제 사용자 입력
2. 어시스턴트의 중간 작업
3. 어시스턴트 최종 답변
4. 토큰/종료 메타데이터

즉:

`user_input -> intermediate work -> final_answer`

## UI 표시 규칙

### 카드

- `Q`: `event_msg.user_message` 기준 첫 사용자 입력
- `A`: `message:final_answer` 1순위
- `A` fallback: final answer가 없을 때 첫 assistant `message:*`
- `developer`는 카드에서 숨김

### 디테일

- `developer`는 기본 접힘 상태
- 중간 작업은 상위 분류 + subtype + 요약 필드로 표시
- `web_search_call`은 `query`, `url`, `pattern` 노출
- `function_call`은 `name`, `arguments` 노출
- `function_call_output`은 exit code, output preview 노출
- `apply_patch`는 patch preview 또는 변경 파일 목록 노출

### 검색

- 기본 검색 대상: `user_input`, `agent_message.final_answer`, `agent_message.commentary`
- 기본 제외: `developer`, raw tool output 전문
- 선택 검색 옵션으로 `web_search.query`, tool arguments 포함 가능

## 저장 스키마 권장안

현재 `items` 테이블 원본 컬럼은 유지한다.
정규화 필드를 추가하거나 importer 단계에서 계산된 view model을 만들 수 있다.

권장 필드:

| 필드 | 설명 |
|---|---|
| `normalized_kind` | 공식 taxonomy 기준 상위 분류 |
| `normalized_subtype` | 앱용 세분 분류 |
| `is_final_answer` | 최종 답변 여부 |
| `is_user_visible` | 기본 UI 노출 여부 |
| `is_injected_context` | 개발자/시스템 주입 여부 |
| `tool_name` | `function_call`, `custom_tool_call` 이름 |
| `action_type` | `web_search_call.action.type` |
| `summary_text` | 카드/디테일용 짧은 요약 |

## importer fallback 규칙

1. 먼저 구조 신호로 판별한다.
2. 구조 신호가 없을 때만 문자열 heuristic를 쓴다.

예:

- 사용자 프리뷰: `event_msg.user_message` 우선
- AGENTS 부트스트랩 제거: `response_item(role=user)`만 있고 `user_message` 대응 이벤트가 없는 경우 fallback에서 제외
- 새 `kind` 발생 시: `normalized_kind = unknown`

## 현재 관측됐지만 저장하지 않는 항목

원본 세션 파일에는 `reasoning` item이 존재한다.
현재 importer는 이를 저장하지 않고 건너뛴다.

정책:

- 지금은 저장하지 않음
- 필요 시 `normalized_kind = reasoning`으로 별도 수집 가능
- UI에는 기본 비노출이 적절함

## 유지보수 지침

1. 새 `kind`가 생기면 먼저 원본을 수집한다.
2. 공식 문서의 공개 taxonomy 범주 중 어디에 속하는지 결정한다.
3. `normalized_subtype`만 세분화한다.
4. UI는 가능하면 `normalized_kind` 중심으로 짠다.
5. raw kind 이름에 직접 의존하는 분기 코드는 importer에만 모은다.

## 현재 구현 우선순위

1. 카드 `A`를 `message:final_answer` 우선으로 변경
2. `items` 정규화 view model 추가
3. 디테일 패널에서 분류별 배지와 구조화 필드 노출
4. `developer` 기본 숨김/접기 처리
5. `unknown kind` 진단 패널 추가
