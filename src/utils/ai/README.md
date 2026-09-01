# AI Utilities (`src/utils/ai/`)

The AI agent layer: lets users talk to the bot via `@mention` in Discord and have it answer with real server context and execute bot commands through native tool calling.

## Request Flow

```
messageCreate (@mention / reply)                 chatService.generateResponse(Streaming)
   │                                                       │
   ├─ aiCreditManager.checkAICredits ── out of credits? stop
   │                                                       │
   ├─ systemPromptBuilder.buildSystemContext               │  base prompt cached per
   │     Response Format + Identity + Context + Bot Info   │  guild+role, 5 min
   │     + Requester + Server Info + Capabilities          │  (request-scoped parts
   │                                                       │   rebuilt every call)
   ├─ conversationBuilder.buildMessagesArray               │  system + summary +
   │     (history from conversationManager)                │  history + user msg
   │                                                       │
   ├─ multiProviderAIService.generate ──► OpenRouter       │  TOOL_DEFINITIONS sent
   │     (model + tools from src/config/ai.js)             │  as native tool_calls
   │                                                       │
   └─ chat/actionHandler.processActionsAndReQuery          ▼
         loop (max AI_MAX_ACTION_LOOP_DEPTH, default 2):
           actionExecutor validates + runs actions
           ├─ DATA_FETCH / get_*  ── results fed back, model re-queried
           ├─ execute_command     ── commandExecutor runs the slash command
           │                         via mock interaction (permissions enforced here)
           ├─ show_component      ── Discord buttons/select, waits for choice
           └─ web_search          ── Serper.dev (real Google) → SearXNG fallback
           └─ fetch_page          ── read a URL's text (SSRF-guarded: no
                                      private IPs/metadata/localhost hops)
```

**Security model: the model proposes, code disposes.** Tool calls are validated by `actionRegistry.js`, permission-checked in `actionExecutor.js` / `commandExecutor/commandValidator.js` (admin commands need admin perms + a ✅ confirmation button; `AI_ADMIN_COMMAND_BLOCKLIST` is never executable). The LLM has no authority of its own.

## Key Modules

| Module                                                                           | Role                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chatService.js`                                                                 | Orchestrator: credits, context, generation, actions                                                                                                                                     |
| `chat/`                                                                          | Split logic: `actionHandler` (loop + re-query), `responseGenerator`, `responseProcessor` (legacy JSON fallback parser), `conversationBuilder`, `streamingHelpers`, `preparationHelpers` |
| `multiProviderAIService.js` + `providers/`                                       | Feature-based provider routing (OpenRouter text/images, Stability, RunPod, Civitai)                                                                                                     |
| `toolDefinitions.js`                                                             | Native tool schemas (OpenAI format) + `translateToolCallsToActions`                                                                                                                     |
| `actionRegistry.js`                                                              | Single source of truth for actions: category, guild requirement, `triggersReQuery`, options validation                                                                                  |
| `actionExecutor.js`                                                              | Executes actions with permission gating; `DATA_RETRIEVE` runs in parallel                                                                                                               |
| `commandExecutor/`                                                               | Programmatic slash-command execution via `mockInteraction.js`                                                                                                                           |
| `systemPromptBuilder.js` + `promptSections/` + `src/config/prompts/chat/`        | Prompt assembly                                                                                                                                                                         |
| `commandDiscoverer.js`                                                           | Discovers commands/options for prompts; detects mentioned commands for on-demand injection                                                                                              |
| `conversationManager.js` + `memory/`                                             | History + rolling summaries (see Storage)                                                                                                                                               |
| `aiCreditManager.js`, `costMonitor.js`, `pricingService.js`, `dynamicPricing.js` | Core-credit billing per API call                                                                                                                                                        |
| `concurrencyManager.js`                                                          | Per-user request queue                                                                                                                                                                  |

## Memory / Storage

Backend selected by `AI_CONVERSATION_STORAGE_TYPE` (`file` \| `mongodb` \| `memory`); production uses `mongodb`.

- **History** — MongoDB `ai_conversations`, keyed by session: `ch_<channelId>` for guild channels (shared channel conversation), `<userId>` for DMs. Last `AI_CONVERSATION_HISTORY_LENGTH` (20) messages, expires after `AI_CONVERSATION_TIMEOUT` (7 days). System prompts are never persisted.
- **Summaries** — `memory/summarizer.js` compresses overflow into a rolling summary, re-injected as a leading system message; stored via `memory/summaryStorage.js`.
- **Action memory** — executions recorded as assistant entries `[Action completed - do not retry: ...]`.
- **Reset** — `/chat-reset` (slash) or the `reset_chat` tool (via mention) clears the session key.

## Configuration

Feature/provider config lives in **`src/config/ai.js`** (`getAIModels()`), not `config.js`:

- `features.aiChat` → provider + model for chat (currently `openrouter` + `deepseek/deepseek-v4-flash`; verify the exact ID against openrouter.ai/models when changing)
- `features.avatar / imagineGeneral / imagineNSFW` → image providers with safety levels (`safe` requests never route to NSFW-capable providers)
- `providers.<name>.enabled` + API key → disabled providers are skipped; all disabled ⇒ AI off with a friendly error

## Environment Variables

```env
OPENROUTER_API_KEY=...        # chat + text (required for AI chat)
STABILITY_API_KEY=...         # safe image generation
SERPER_API_KEY=...            # web_search primary (real Google SERP via serper.dev)
SEARXNG_URL=http://searxng:8080/search  # web_search fallback (self-hosted, see docker-compose.prod.yml)
SEARXNG_SECRET=...            # random secret for the searxng container
RUNPOD_ENABLED=true RUNPOD_API_KEY=... RUNPOD_ENDPOINT_ID=...   # optional NSFW images
CIVITAI_ENABLED=true CIVITAI_API_KEY=...                        # optional NSFW images

AI_CONVERSATION_STORAGE_TYPE=mongodb
AI_CONVERSATION_HISTORY_LENGTH=20
AI_CONVERSATION_TIMEOUT=604800000
AI_MAX_ACTION_LOOP_DEPTH=2        # max re-queries per user request
AI_STREAMING_ENABLED=true         # streaming replies
AI_ADMIN_COMMAND_BLOCKLIST=...    # comma-separated; overrides default blocklist
AI_AUDIT_LOGGING=false            # [AI_AUDIT] log lines (on by default)
```

## Adding a New Action/Tool (checklist)

1. Add entry to `ACTION_REGISTRY` (`actionRegistry.js`) — category + `triggersReQuery` + required options.
2. Add matching schema to `TOOL_DEFINITIONS` (`toolDefinitions.js`) — keep descriptions _when-to-use_ style.
3. Implement in `actionExecutor.js` — `executeDataRetrieveAction` for parallel lookups, `executeSequentialAction` for everything with side effects. **Permission-check here, never trust the model.**
4. If it maps to a bot command, prefer `execute_command` over a bespoke action.
5. Update `translateToolCallsToActions` if the argument shape is special.

## Observability

- `[AI_AUDIT]` — every command/action execution (who, what, result)
- `[AI] tool_use response: N tool call(s)` — native tool calling active; absence + JSON text = fallback path
- `[OPENROUTER USAGE]` — per-call tokens; `Cached Tokens` shows prompt-prefix cache hits (keep the system prompt prefix stable or costs balloon ~5×)

## Gotchas

- Prompt bloat: never add per-second/per-request dynamic content to the system prompt base — it breaks DeepSeek prefix caching (date/time lives in the user message for this reason).
- The legacy JSON `{message, actions}` path (`responseProcessor.js`) is a _fallback_ only; new models should rely on tool calls.
- System prompt sent exactly once: it lives in `messages[0]` (buildMessagesArray); providers must not receive it again via `config.systemMessage` on the main path.
- `entry points`: chat is mention-based; `/chat` and `/imagine` commands are intentionally `disabled = true`.
