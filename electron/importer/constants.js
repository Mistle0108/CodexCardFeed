const IMPORTER_LAYOUT_VERSION = 3;
const IMPORTER_LAYOUT_VERSION_KEY = "codex_card_feed_importer_layout_version";
const SESSION_INDEX_SIGNATURE_KEY = "codex_card_feed_session_index_signature";
const GLOBAL_STATE_SIGNATURE_KEY = "codex_card_feed_global_state_signature";
const SESSION_DIAGNOSIS_SNAPSHOT_KEY = "diagnostic_snapshot.session_diagnosis";
const SOURCE_FILE_STATUS_ACTIVE = "active";
const SOURCE_FILE_STATUS_MISSING = "missing";
const SOURCE_FILE_STATUS_ERROR = "error";
const KNOWN_TOP_LEVEL_ENTRY_TYPES = new Set([
  "session_meta",
  "turn_context",
  "event_msg",
  "response_item",
  "compacted"
]);
const KNOWN_EVENT_MSG_TYPES = new Set([
  "agent_message",
  "context_compacted",
  "dynamic_tool_call_request",
  "dynamic_tool_call_response",
  "error",
  "exec_command_end",
  "image_generation_end",
  "item_completed",
  "mcp_tool_call_end",
  "patch_apply_end",
  "task_complete",
  "task_started",
  "thread_name_updated",
  "thread_rolled_back",
  "token_count",
  "turn_aborted",
  "user_message",
  "view_image_tool_call",
  "web_search_end"
]);
const KNOWN_RESPONSE_ITEM_TYPES = new Set([
  "custom_tool_call",
  "custom_tool_call_output",
  "function_call",
  "function_call_output",
  "image_generation_call",
  "message",
  "reasoning",
  "tool_search_call",
  "tool_search_output",
  "web_search_call"
]);

module.exports = {
  IMPORTER_LAYOUT_VERSION,
  IMPORTER_LAYOUT_VERSION_KEY,
  SESSION_INDEX_SIGNATURE_KEY,
  GLOBAL_STATE_SIGNATURE_KEY,
  SESSION_DIAGNOSIS_SNAPSHOT_KEY,
  SOURCE_FILE_STATUS_ACTIVE,
  SOURCE_FILE_STATUS_MISSING,
  SOURCE_FILE_STATUS_ERROR,
  KNOWN_TOP_LEVEL_ENTRY_TYPES,
  KNOWN_EVENT_MSG_TYPES,
  KNOWN_RESPONSE_ITEM_TYPES
};
