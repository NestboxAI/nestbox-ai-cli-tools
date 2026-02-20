# Report Configuration Guide — Schema v2.2

> **For AI agents:** This document is your complete instructions for generating a valid `report_config.yaml`. Read every section before generating. Pay special attention to the [Quick Checklist](#quick-checklist) and [Computations](#5-computations) sections.

---

## Table of Contents

1. [Overview & Pipeline](#overview--pipeline)
2. [Quick Checklist](#quick-checklist)
3. [Top-Level Structure](#top-level-structure)
4. [report](#1-report)
5. [context](#2-context)
6. [docsets](#3-docsets)
7. [llamaindex](#4-llamaindex)
8. [computations](#5-computations)
   - [fields](#fields)
   - [tables](#tables)
   - [DocsetSubtask (agents)](#docsetsubtask-agents)
   - [Autonomous vs. Explicit Search Mode](#autonomous-vs-explicit-search-mode)
   - [output_schema](#output_schema)
   - [depends_on](#depends_on)
9. [template](#6-template)
   - [Placeholder Syntax](#placeholder-syntax)
   - [Pipe Filters](#pipe-filters)
10. [guardrails](#7-guardrails)
11. [execution](#8-execution)
12. [storage & doc_repository](#9-storage--doc_repository)
13. [prompts](#10-prompts)
14. [mcp](#11-mcp)
15. [Environment Variables](#environment-variables)
16. [Complete Minimal Example](#complete-minimal-example)
17. [Full Annotated Example (Finance)](#full-annotated-example-finance)

---

## Overview & Pipeline

The YAML config is a **declarative specification** — you describe *what* to extract, and the framework drives a ReAct agent loop automatically. Here is how every config section maps to a pipeline stage:

```
YAML config
  │
  ├── docsets        → GraphRAG parquet files loaded (entities, relationships, communities, text_units)
  ├── llamaindex     → LLM and agent settings (model, timeouts, prompts)
  ├── computations   → Agent spawned per subtask → searches GraphRAG → returns JSON validated against output_schema
  │     ├── fields   → Single structured values (ARR snapshot, liquidity metrics, executive summary)
  │     └── tables   → Tabular output rendered as markdown table in the report
  ├── template       → Computed values injected into markdown via {{field.id.property}} placeholders
  └── guardrails     → LLM-judge checks run on computed values and/or the rendered report
```

**Execution order:**
1. All docsets pre-loaded from disk or downloaded from `doc_repository`
2. Computations with no `depends_on` run in parallel
3. Computations that declare `depends_on` run only after their dependencies complete
4. Template rendered after all computations finish
5. Guardrails run last on the completed outputs

---

## Quick Checklist

Before writing the config, confirm you have answered:

- [ ] **What is the source document?** → drives `docsets` and document `locator`
- [ ] **What metrics/sections need to be extracted?** → drives `computations.fields`
- [ ] **Do any metrics need tabular/historical data?** → drives `computations.tables`
- [ ] **What should the final report look like?** → drives `template.content`
- [ ] **Do any extractions depend on prior results?** → drives `depends_on`
- [ ] **Which search type fits each extraction task?**
  - Exact numbers, tables → `basic` or autonomous
  - Entity/relationship lookups → `local` or autonomous
  - High-level themes, summaries → `global` or autonomous
  - Multi-hop graph exploration → `drift`
- [ ] **What quality checks are needed?** → drives `guardrails`

---

## Top-Level Structure

Required fields are marked with `*`.

```yaml
schema_version: "2.2"          # * Always "2.2"
report: ...                    # * Report identity
context: ...                   # Runtime variables referenced in prompts
prompts: ...                   # Named reusable prompt strings
storage: ...                   # For local file-based documents
doc_repository: ...            # For API-based document downloads
mcp: []                        # MCP server endpoints (use [] if none)
docsets: [...]                 # * Document collections to query
llamaindex: ...                # * LLM agent configuration
computations: ...              # * What to extract
template: ...                  # * Output template
guardrails: [...]              # LLM-judge quality checks
execution: ...                 # Retry and output settings
```

---

## 1. `report`

**Purpose:** Identifies the report. Used in file names, template placeholders, and logs.

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `id` | Yes | string | Lowercase, alphanumeric, underscores/hyphens. Used in output filenames. |
| `name` | Yes | string | Human-readable name shown in logs and reports. |
| `description` | No | string | Longer description of purpose and scope. |
| `version` | No | string | Reporting period version (e.g., "2025.Q4"). |

```yaml
report:
  id: acme_cfo_kpi_q4_2025
  name: "Acme CFO KPI Pack — Q4 2025"
  description: |
    Quarterly KPI extraction from the Q4 2025 Board Presentation.
    Covers ARR, retention, liquidity, bookings, and marketing metrics.
  version: "2025.Q4"
```

---

## 2. `context`

**Purpose:** Defines runtime variables that can be referenced anywhere in prompts and templates as `{{context.variable_name}}`. Also holds policies that guide agent behavior.

- All fields are **optional** at the schema level
- You can add **any custom key** — `context` allows extra properties
- Use context variables to avoid hardcoding company names, periods, or policies into every prompt

### Standard fields

| Field | Description |
|-------|-------------|
| `company_name` | Injected into prompts to identify the company |
| `currency` | Default "USD" |
| `units_policy` | Instructions for how to handle number units ($M vs full dollars, etc.) |
| `answer_quality_policy` | Numeric precision and citation requirements |
| `value_types` | Allowed value type labels for classification |

### Custom fields

Any key you add becomes available in prompts and template as `{{context.your_key}}`.

```yaml
context:
  company_name: "Acme Corp, Inc."
  currency: "USD"
  as_of_period: "CY2025 Q4"
  meeting_date: "2026-01-15"
  source_title: "Q4 2025 Board Meeting Presentation"
  units_policy: |
    Return raw numeric values — no $, commas, or M/K suffixes.
    Convert abbreviated values: "$2.5M" → 2500000, "$350K" → 350000.
    Percentages as whole numbers: 92.3 not 0.923.
  answer_quality_policy:
    numeric_requirements:
      - "Every numeric value must have a citation (c_xxxxxxxx format)"
      - "Return null if the value is not found — never guess"
    labeling_requirements:
      - "Include period label (e.g., 2025Q4) with every metric"
  value_types:
    - "money_usd"
    - "percent"
    - "count"
    - "multiple"
    - "string"
    - "date"
  kpi_namespace: "acme.board.25q4"
```

---

## 3. `docsets`

**Purpose:** Declares the GraphRAG-indexed document collections the agent will search. Each docset groups one or more documents and is referenced by `docset_id` in computations.

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `id` | Yes | string | Unique identifier referenced in computations |
| `docs` | Yes | array | At least one document |
| `description` | No | string | What this docset represents |
| `api_key` | No | string | OpenAI API key for GraphRAG searches. Falls back to `OPENAI_API_KEY` env var. |

### Document fields

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Yes | Unique doc identifier |
| `locator` | Recommended | See below for three forms |
| `description` | No | Human-readable description |
| `alias` | No | Short name for use in prompts |

### Three ways to specify a document location

**1. Local filesystem path** — points directly to the GraphRAG output directory:
```yaml
locator: /data/graphrag/board_deck/output
locator: ./documents/doc-abc123/graphrag/output    # relative to config file
```

**2. `repo:doc-ID`** — download from the doc_repository API (requires `doc_repository` configured):
```yaml
locator: "repo:doc-eeb76651"
```

**3. Bare doc-ID** — check local cache first, then download from repo:
```yaml
locator: doc-a850ad6f
```

> **Legacy:** `document_id` is deprecated. Use `locator` instead.

### Example — single docset, one document

```yaml
docsets:
  - id: acme_board_deck_q4
    description: "Acme Q4 2025 Board Presentation — GraphRAG indexed"
    api_key: ${OPENAI_API_KEY}
    docs:
      - id: board_deck_pdf
        locator: "repo:doc-eeb76651"
        description: "Q4 2025 Board Meeting Presentation"
        alias: q4_deck
```

### Example — two docsets (board deck + financial statements)

```yaml
docsets:
  - id: board_deck
    description: "Board presentation slides"
    api_key: ${OPENAI_API_KEY}
    docs:
      - id: deck_pdf
        locator: "repo:doc-abc12345"
        description: "Q4 2025 Board Deck"

  - id: financials
    description: "Audited financial statements"
    api_key: ${OPENAI_API_KEY}
    docs:
      - id: income_statement
        locator: ./documents/income_stmt/graphrag/output
      - id: balance_sheet
        locator: ./documents/balance_sheet/graphrag/output
```

---

## 4. `llamaindex`

**Purpose:** Configures the LLM and ReAct agent that drives all extraction. One block controls all agents in the report.

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `model` | Yes | — | LLM model ID: `gpt-4o`, `gpt-4.1-mini`, `claude-3-5-sonnet`, etc. |
| `api_key` | Yes | — | Supports `${ENV_VAR}` |
| `base_url` | No | OpenAI default | Custom endpoint (Azure, vLLM, Ollama) |
| `max_tool_calls` | No | 20 | Per-subtask tool call limit (1–100) |
| `tool_timeout_seconds` | No | 120 | Per-tool-call timeout (1–600) |
| `max_agent_iterations` | No | 30 | ReAct loop iterations before stopping (1–100) |
| `max_repair_attempts` | No | 2 | Schema validation repair loops (1–10) |
| `system_prompt` | No | Built-in | Main system prompt for all agents |
| `autonomous_search_guidance` | No | Built-in | Guidance for choosing between search tools in autonomous mode |
| `synthesis_prompt` | No | Built-in | Template combining multiple subtask outputs. Placeholders: `{{subtask_results}}`, `{{output_schema}}` |
| `validation_repair_prompt` | No | Built-in | Prompt for fixing schema validation failures. Placeholders: `{{raw_response}}`, `{{validation_errors}}`, `{{output_schema}}` |
| `guardrail_system_prompt` | No | Built-in | Default system prompt for guardrail LLM-judge calls |
| `json_extraction_prompt` | No | Built-in | Fallback for extracting JSON from non-JSON agent responses |
| `mcp_system_prompt` | No | Built-in | System prompt for MCP integration agents |

### Recommended model choices

| Use Case | Recommended Model |
|----------|------------------|
| High-accuracy financial extraction | `gpt-4o` |
| Cost-efficient extraction | `gpt-4.1-mini` |
| Claude-based extraction | `claude-3-5-sonnet` |
| Guardrail LLM-judge | `gpt-4.1-mini` (fast, cheap) |

### Minimal example

```yaml
llamaindex:
  model: gpt-4o
  api_key: ${OPENAI_API_KEY}
```

### Full example with custom prompts

```yaml
llamaindex:
  model: gpt-4o
  base_url: ${OPENAI_BASE_URL:-https://api.openai.com/v1}
  api_key: ${OPENAI_API_KEY}
  max_tool_calls: 50
  tool_timeout_seconds: 180
  max_agent_iterations: 40
  max_repair_attempts: 3
  system_prompt: |
    You are a CFO-grade KPI extraction analyst with expertise in financial document analysis.

    ## ANTI-FABRICATION RULE — READ FIRST
    NEVER return values from this prompt or any instruction text.
    ALL values MUST come from your search tool results.
    If a value is not found in search results, return null.

    ## Critical Rules
    1. NEVER FABRICATE: If a value isn't found, return null — never guess
    2. EXACT VALUES: Use values exactly as found in documents
    3. CITE EVERYTHING: Every numeric value needs a citation
    4. RAW NUMBERS: Return 9697083 not "$9.7M" — no formatting
    5. LABEL PERIODS: Always identify the time period (e.g., 2025Q4)
```

> **Tip for agents:** The built-in system prompt is already well-tuned for financial extraction. Only override `system_prompt` if you need domain-specific behavior or stricter rules. When you do override it, always include an anti-fabrication rule.

---

## 5. `computations`

**Purpose:** Declares what to extract from the documents. Computations have two subtypes:
- **`fields`** — produce a single structured value (a snapshot, a set of metrics)
- **`tables`** — produce tabular data rendered as a markdown table

Each computation contains one or more **agent subtasks** (`agents`). Each subtask spawns an independent ReAct agent that queries GraphRAG and returns a JSON output validated against an `output_schema`.

---

### Fields

A field computation produces a single structured JSON value. Use fields for KPI snapshots, summaries, and any structured metric sets.

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `id` | Yes | — | Lowercase alphanumeric + underscores. Referenced in template as `{{field.id}}` |
| `label` | Yes | — | Human-readable name shown in logs |
| `prompt` | Yes | — | Synthesis prompt combining all subtask outputs into the final result |
| `agents` | No | — | Array of DocsetSubtask (see below). At least one of `agents` or `mcp_scope` needed. |
| `mcp_scope` | No | — | MCP subtasks to run alongside agent subtasks |
| `docset_id` | No | — | Default docset for all subtasks (overridden per-subtask) |
| `type` | No | `object` | Output type hint: `object`, `number`, `string` |
| `description` | No | — | Detailed description |
| `priority` | No | 0 | Execution order hint — lower runs first |
| `depends_on` | No | — | Array of field/table IDs that must complete first |
| `output_schema` | No | — | Final JSON schema (only needed for multi-agent synthesis where schemas differ) |

```yaml
computations:
  fields:
    - id: arr_snapshot
      label: "ARR & Retention Snapshot (Q4 2025)"
      type: object
      priority: 1
      docset_id: acme_board_deck_q4
      agents:
        - id: arr_extract
          prompt: |
            Extract the Q4 2025 ARR waterfall and retention metrics.
            ...
          output_schema:
            type: object
            properties:
              arr_end: { type: number }
              nrr: { type: number }
              citations: { type: array, items: { type: string } }
      mcp_scope: []
      prompt: "Return the Q4 2025 ARR snapshot with citations."
```

---

### Tables

A table computation produces an array of rows rendered as a markdown table in the report. Use tables for historical data, multi-period comparisons, and any row-per-item data.

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `id` | Yes | — | Referenced in template as `{{table.id}}` |
| `title` | Yes | — | Table title (used in the rendered table header) |
| `prompt` | Yes | — | Synthesis prompt |
| `agents` | No | — | Same as fields |
| `docset_id` | No | — | Default docset |
| `priority` | No | 0 | Execution order |
| `depends_on` | No | — | Dependencies |
| `output_schema` | No | — | JSON schema for the final table |

> **Output format:** The agent's `output_schema` for a table should always use `{"type": "object", "properties": {"rows": {"type": "array", "items": {...}}}}`. The framework extracts the `rows` array and renders it as a markdown table.

```yaml
computations:
  tables:
    - id: arr_quarterly_history
      title: "ARR Waterfall — Quarterly History"
      priority: 2
      docset_id: acme_board_deck_q4
      agents:
        - id: arr_history_extract
          prompt: |
            Extract the full quarterly ARR waterfall table.
            For EACH quarter shown: period, beg_arr, new_logos_arr, net_upsell_arr,
            churn_arr, end_arr, nrr, grr.
            Return {"rows": [...]} with one object per quarter.
          output_schema:
            type: object
            properties:
              rows:
                type: array
                items:
                  type: object
                  properties:
                    period: { type: string }
                    beg_arr: { type: number }
                    end_arr: { type: number }
                    nrr: { type: number }
                    citations: { type: array, items: { type: string } }
      mcp_scope: []
      prompt: "Return quarterly ARR history with citations per row."
```

---

### DocsetSubtask (`agents`)

Each entry in `agents` is a **DocsetSubtask** — an independent agent run that queries one docset and returns an intermediate JSON result.

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Yes | Unique subtask ID (lowercase alphanumeric + underscores) |
| `prompt` | Yes | What to extract. Be specific and include search strategy guidance. |
| `output_schema` | Yes | JSON Schema the agent output must conform to |
| `docset_id` | No | Overrides the computation-level `docset_id` |
| `search_type` | No | `basic`, `local`, `global`, `drift`. **Omit for autonomous mode.** |
| `options` | No | Search options (only used when `search_type` is set — see below) |

```yaml
agents:
  - id: liquidity_extract
    docset_id: acme_board_deck_q4          # optional override
    search_type: basic                      # explicit, or omit for autonomous
    options:
      basic_search:
        k: 15                              # retrieve 15 chunks instead of default 10
    prompt: |
      Extract cash and runway metrics from the CFO report section.
      ...
    output_schema:
      type: object
      properties:
        cash_current: { type: number }
        runway_months: { type: number }
        citations: { type: array, items: { type: string } }
```

---

### Autonomous vs. Explicit Search Mode

**Autonomous mode** (recommended for most use cases) — omit `search_type`. The agent has access to all four search tools and decides which to use based on the task. The `autonomous_search_guidance` (built-in or custom) teaches it when to pick each tool.

```yaml
agents:
  - id: arr_extract
    # No search_type — agent chooses
    prompt: |
      Extract ARR waterfall metrics for Q4 2025.
      For exact table values: try basic_search first.
      For entity relationships: use local_search.
    output_schema: ...
```

**Explicit mode** — set `search_type` when you have a strong reason to restrict the agent to one search method. This prevents the agent from trying other tools.

| `search_type` | Best For |
|---------------|----------|
| `basic` | Exact values, tables, specific numbers, slide content |
| `local` | Entity/relationship lookups (who owns what, person-metric connections) |
| `global` | High-level summaries, themes, cross-document synthesis |
| `drift` | Multi-hop exploration, deep graph traversal across entities |

```yaml
agents:
  - id: themes_extract
    search_type: global       # force global search for high-level themes
    prompt: |
      Identify the major strategic themes discussed across the entire deck.
      DO NOT use basic_search — you need community-level summaries.
    output_schema: ...
```

### Search Options (when using explicit mode)

Options are nested **under the search type key**:

```yaml
agents:
  - id: arr_extract
    search_type: basic
    options:
      basic_search:
        k: 15                       # number of chunks to retrieve (default 10)
        chat_model_id: gpt-4o       # override model for this search
        embedding_model_id: text-embedding-3-large

  - id: entity_map
    search_type: local
    options:
      local_search:
        top_k_entities: 20          # retrieve more entities (default 10)
        top_k_relationships: 20
        max_context_tokens: 16000

  - id: themes_extract
    search_type: global
    options:
      global_search:
        max_context_tokens: 12000
        data_max_tokens: 6000
        map_max_length: 2000
        reduce_max_length: 1800

  - id: deep_explore
    search_type: drift
    options:
      drift_search:
        n_depth: 3                  # hop depth (default 2)
        drift_k_followups: 6        # follow-ups per hop
        concurrency: 4
```

---

### `output_schema`

The `output_schema` is a JSON Schema object that the agent output must satisfy. The framework validates the agent response and runs a repair loop (up to `max_repair_attempts`) if validation fails.

**Rules for writing output_schema:**
1. Always include `type: object` at the root
2. Include a `citations` array in every schema — this is how you enforce traceability
3. Add `notes` string for agent to record caveats about missing data
4. Use `minimum`/`maximum` constraints to catch unit errors (e.g., retention percentages must be 80–120, not 0.80–1.20)
5. Use `type: number` for all numeric values — never `integer` unless the value genuinely cannot be a decimal
6. Keep schemas specific — the tighter the schema, the better the agent's output

```yaml
output_schema:
  type: object
  properties:
    period_label:
      type: string                              # "2025Q4" — the reporting period
    arr:
      type: object
      properties:
        beg: { type: number }                   # beginning ARR (full dollars, e.g. 9697083)
        new_logos: { type: number }             # ARR from new customers
        net_upsell: { type: number }            # net expansion ARR
        churn: { type: number }                 # lost ARR (negative number, e.g. -81579)
        end: { type: number }                   # ending ARR
    retention:
      type: object
      properties:
        nrr: { type: number, minimum: 50, maximum: 150 }   # whole-number %, e.g. 112.3
        grr: { type: number, minimum: 50, maximum: 100 }   # e.g. 88.5
    citations:
      type: array
      items: { type: string }                   # ["c_926fdeb6", "c_ab12cd34"]
    notes:
      type: string                              # explain missing values
```

> **For agents:** The `output_schema` IS the spec. Match it exactly. Do not add or remove properties not in the schema.

---

### `depends_on`

Computations can depend on other computations. A computation listed in `depends_on` must complete successfully before this one starts. Use this when:
- A synthesis computation needs the results of prior extractions
- One computation's output is referenced in another computation's prompt

```yaml
computations:
  fields:
    # arr_snapshot runs first (no depends_on)
    - id: arr_snapshot
      label: "ARR Snapshot"
      priority: 1
      agents: [...]
      prompt: "Extract Q4 ARR metrics."

    # executive_summary runs AFTER arr_snapshot completes
    # It can reference arr_snapshot results in its prompt
    - id: executive_summary
      label: "Executive Summary"
      priority: 2
      depends_on: [arr_snapshot]              # wait for arr_snapshot
      agents:
        - id: exec_extract
          prompt: |
            Generate the executive summary.
            Note: ARR snapshot results are available in your context.
          output_schema: ...
      prompt: "Synthesize the executive summary."
```

---

## 6. `template`

**Purpose:** Defines the markdown report structure. Computed values are injected using placeholder syntax.

| Field | Required | Notes |
|-------|----------|-------|
| `content` | Yes | Main markdown template with placeholders |
| `format` | No | Only `"markdown"` supported |
| `sections` | No | Reusable named blocks referenced as `{{sections.name}}` |

### Placeholder Syntax

| Syntax | Resolves To |
|--------|-------------|
| `{{field.id}}` | The full computed value object (JSON) |
| `{{field.id.property}}` | A single property of a field's output |
| `{{field.id.nested.property}}` | Nested property access |
| `{{table.id}}` | The table rendered as a markdown table |
| `{{context.key}}` | A context variable |
| `{{report.id}}` / `{{report.name}}` | Report metadata |
| `{{sections.name}}` | A reusable section block |

```yaml
template:
  format: markdown
  sections:
    report_header: |
      # {{report.name}}
      > **Source:** {{context.source_title}}
      > **Period:** {{context.as_of_period}}
      > **Generated by:** Nestbox AI Report Generator

  content: |
    {{sections.report_header}}

    ---

    ## ARR & Retention (Q4 2025)

    | Metric | Value |
    |--------|-------|
    | Beg ARR | {{field.arr_snapshot.arr.beg}} |
    | End ARR | {{field.arr_snapshot.arr.end}} |
    | NRR     | {{field.arr_snapshot.retention.nrr}}% |

    ### Quarterly History
    {{table.arr_quarterly_history}}

    ---

    ## Liquidity
    Cash on hand: {{field.liquidity.cash_current}}
```

### Pipe Filters

Placeholders support pipe chains to format values. Filters are applied left to right.

| Filter | Syntax | Effect | Example |
|--------|--------|--------|---------|
| `currency` | `\| currency("$", 0)` | Format as currency with N decimal places | `9697083` → `$9,697,083` |
| `number` | `\| number(1)` | Format as decimal with N places | `92.3456` → `92.3` |
| `default` | `\| default("—")` | Fallback if value is null/missing | `null` → `—` |

```yaml
# Examples of pipe usage
{{ field.arr_snapshot.arr.end | currency("$", 0) | default("—") }}
# → "$10,144,379" or "—" if null

{{ field.arr_snapshot.retention.nrr | number(1) | default("N/A") }}
# → "92.3" or "N/A" if null

{{ field.arr_snapshot.arr.churn | currency("$", 0) | default("—") }}
# → "-$81,579" (negative values shown with minus sign)
```

> **Note:** Always add `| default("—")` for financial values that may be null. This prevents the template from rendering "None" or breaking.

### Full template example

```yaml
template:
  format: markdown
  sections:
    header: |
      # {{report.name}}
      > **Period:** {{context.as_of_period}} | **Company:** {{context.company_name}}

  content: |
    {{sections.header}}

    ---

    ## ARR & Retention

    **Period:** {{ field.arr_snapshot.period_label | default("N/A") }}

    ### ARR Waterfall
    | Metric | Value |
    |--------|-------|
    | Beg ARR | {{ field.arr_snapshot.arr.beg | currency("$", 0) | default("—") }} |
    | + New Logos | {{ field.arr_snapshot.arr.new_logos | currency("$", 0) | default("—") }} |
    | + Net Upsell | {{ field.arr_snapshot.arr.net_upsell | currency("$", 0) | default("—") }} |
    | − Churn | {{ field.arr_snapshot.arr.churn | currency("$", 0) | default("—") }} |
    | **End ARR** | **{{ field.arr_snapshot.arr.end | currency("$", 0) | default("—") }}** |

    **NRR:** {{ field.arr_snapshot.retention.nrr | number(1) | default("—") }}%

    **Citations:** {{ field.arr_snapshot.citations | default("*None*") }}

    ### Quarterly History
    {{table.arr_quarterly_history}}

    ---

    ## Liquidity & Runway

    | Metric | Value |
    |--------|-------|
    | Cash on Hand | {{ field.liquidity.cash_current | currency("$", 0) | default("—") }} |
    | Monthly Burn | {{ field.liquidity.monthly_burn | currency("$", 0) | default("—") }}/mo |
    | Runway | {{ field.liquidity.runway_months | number(1) | default("—") }} months |

    **Citations:** {{ field.liquidity.citations | default("*None*") }}
```

---

## 7. `guardrails`

**Purpose:** LLM-judge checks that run after all computations complete. Used to enforce data quality (citation completeness, arithmetic correctness, no fabricated values, unit sanity).

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Yes | Lowercase alphanumeric + underscores. Starts with `gr_` by convention. |
| `target` | Yes | What to validate — see target types below |
| `on_fail` | Yes | `"error"` — blocks output and raises error. `"warn"` — reports issue but continues. |
| `model` | Yes | LLM model for judge (e.g., `gpt-4.1-mini` is cost-effective) |
| `api_key` | Yes | Supports `${ENV_VAR}` |
| `prompt` | Yes | Validation prompt. Use `{{content}}` placeholder for the value being checked. |
| `base_url` | No | Custom endpoint for guardrail LLM |
| `system_prompt` | No | Overrides `llamaindex.guardrail_system_prompt` for this guardrail |
| `description` | No | Human-readable description |

### Target types

| Target | Validates |
|--------|-----------|
| `computations` | All computed fields and tables as a single JSON blob |
| `field.{id}` | A single field computation (e.g., `field.arr_snapshot`) |
| `table.{id}` | A single table computation (e.g., `table.arr_quarterly_history`) |
| `final_report` | The rendered markdown report |

### Guardrail prompt guidelines

1. Use `{{content}}` where the value to check should appear
2. Always specify the expected output format: `Return JSON: {"pass": boolean, "issues": [...]}`
3. Define clear, unambiguous pass/fail rules
4. Set `on_fail: warn` during development; promote to `on_fail: error` for production

```yaml
guardrails:
  # Check 1: All numeric values have citations
  - id: gr_citation_check
    target: computations
    on_fail: warn
    model: gpt-4.1-mini
    api_key: ${OPENAI_API_KEY}
    description: "Verify all numeric values have citations"
    prompt: |
      Review the computed JSON and check that every numeric value
      has at least one citation in c_xxxxxxxx format.
      Empty citations arrays [] are failures.

      Return JSON: {"pass": boolean, "issues": ["list of fields missing citations"]}

      Content to check:
      {{content}}

  # Check 2: ARR waterfall arithmetic
  - id: gr_arr_math
    target: field.arr_snapshot
    on_fail: warn
    model: gpt-4.1-mini
    api_key: ${OPENAI_API_KEY}
    description: "Verify ARR bridge arithmetic"
    prompt: |
      Validate: beg + new_logos + net_upsell + churn = end
      Note: churn is already negative — ADD it, do not subtract.
      Allow 1% tolerance for rounding.

      Return JSON: {
        "pass": boolean,
        "computed_end": number,
        "stated_end": number,
        "difference": number,
        "issues": []
      }

      Content: {{content}}

  # Check 3: Fabrication detection
  - id: gr_no_fabrication
    target: computations
    on_fail: warn
    model: gpt-4.1-mini
    api_key: ${OPENAI_API_KEY}
    description: "Detect placeholder or fabricated values"
    prompt: |
      FAIL if you find ANY:
      1. Citations like "Source A", "Source B" (real ones use c_xxxxxxxx hex format)
      2. All ARR values suspiciously round (100000, 200000, 300000) — indicates fabrication
      3. Retention values below 1.0 (should be whole-number percent: 92.3 not 0.923)

      Return JSON: {"pass": boolean, "issues": []}

      Content: {{content}}

  # Check 4: Final report completeness
  - id: gr_report_populated
    target: final_report
    on_fail: warn
    model: gpt-4.1-mini
    api_key: ${OPENAI_API_KEY}
    description: "Verify final report has real content"
    prompt: |
      Check: Does the report contain actual numeric data (not just "—" placeholders)?
      Are the main sections populated?

      Return JSON: {
        "pass": boolean,
        "sections_populated": [],
        "sections_empty": [],
        "issues": []
      }

      Content: {{content}}
```

---

## 8. `execution`

**Purpose:** Controls retries, output directory, and which output files are generated.

```yaml
execution:
  retries:
    max_attempts: 3        # per-computation retry attempts (default 3)
    backoff_seconds: 2.0   # seconds between retries (default 1.0)
  output:
    directory: ./output            # output directory (default "./output")
    timestamp_suffix: false        # add timestamp to dir name (default false)
    include_final_report: true     # generate final_report.md (default true)
    include_computed_json: true    # generate computed.json (default true)
    include_evidence: true         # generate evidence.json (default true)
    include_guardrails: true       # run guardrails and generate guardrails.json (default true)
```

**Output files generated:**

| File | Contents |
|------|----------|
| `final_report.md` | Rendered markdown report from template |
| `computed.json` | Raw extracted values with metadata and validation status |
| `evidence.json` | Full source traceability — all search results, agent traces, tool calls |
| `guardrails.json` | Guardrail results — pass/fail per check, issues found |

---

## 9. `storage` & `doc_repository`

### `storage` — for local filesystem documents

Use when documents are stored locally on disk under `document_id` folder names (legacy pattern).

```yaml
storage:
  base_path: ./documents           # root directory containing doc-XXXXXXXX folders
  graphrag_subpath: graphrag/output  # subfolder within each document folder
```

With this config, `document_id: doc-abc123` resolves to `./documents/doc-abc123/graphrag/output`.

> **Prefer `locator` in docs** — it's more explicit and supports all three resolution strategies.

### `doc_repository` — for API-based document downloads

Use when documents are stored in a Nestbox document repository and should be downloaded on demand.

```yaml
doc_repository:
  api_base_url: https://your-doc-repo.example.com
  api_key: ${DOC_REPO_API_KEY}
  rotation: 200     # max cached documents before FIFO eviction (default 200)
```

With this config, `locator: "repo:doc-eeb76651"` downloads the document from the API and caches it locally.

---

## 10. `prompts`

**Purpose:** Define reusable named prompt strings. Reference them by name in `llamaindex` settings or computation prompts.

```yaml
prompts:
  strict_citation_rules: |
    CITATION RULES — ENFORCE STRICTLY:
    Every numeric value MUST have a citation in c_xxxxxxxx format.
    Never return an empty citations array. If you found it in a search result,
    it has a [CITE AS: "c_xxxxxxxx"] marker — use it.

  units_reminder: |
    UNIT RULES:
    Return raw full numbers: 9697083 not "$9.7M"
    Convert: "$2.5M" → 2500000, "$350K" → 350000
    Percentages as whole numbers: 92.3 not 0.923
```

Then reference in prompts:
```yaml
agents:
  - id: arr_extract
    prompt: |
      Extract ARR metrics.
      {{prompts.strict_citation_rules}}
      {{prompts.units_reminder}}
      ...
```

---

## 11. `mcp`

**Purpose:** Model Context Protocol endpoints for writing extracted data to external systems (e.g., a KPI database, CRM, or data warehouse). Leave as `mcp: []` if not using external integrations.

```yaml
mcp:
  - id: system_of_record
    type: streamable-http
    url: ${SOR_MCP_URL}
    headers:
      Authorization: "Bearer ${SOR_MCP_TOKEN}"
    timeout_seconds: 60
    description: "KPI upsert endpoint for board metrics database"
```

MCP subtasks are then added to computations via `mcp_scope`:

```yaml
computations:
  fields:
    - id: arr_snapshot
      agents: [...]
      mcp_scope:
        - id: system_of_record        # must match an id in the mcp array
          prompt: |
            Upsert the extracted ARR metrics to the system of record.
            Use namespace: {{context.kpi_namespace}}
      prompt: "Return ARR snapshot and upsert to system of record."
```

---

## Environment Variables

All string fields support env var substitution:

| Syntax | Behavior |
|--------|----------|
| `${VAR_NAME}` | Required — error if missing |
| `${VAR_NAME:-default_value}` | Optional — uses default if missing |

```yaml
llamaindex:
  api_key: ${OPENAI_API_KEY}                                # required
  base_url: ${OPENAI_BASE_URL:-https://api.openai.com/v1}  # optional with default

doc_repository:
  api_key: ${DOC_REPO_API_KEY}                              # required
  api_base_url: ${DOC_REPO_URL:-http://localhost:8080}      # optional with default
```

---

## Complete Minimal Example

The smallest valid configuration — one computation, one subtask, minimal template:

```yaml
schema_version: "2.2"

report:
  id: minimal_arr_report
  name: "Minimal ARR Report"

context:
  company_name: "Acme Corp"
  as_of_period: "Q4 2025"

docsets:
  - id: main_deck
    api_key: ${OPENAI_API_KEY}
    docs:
      - id: board_deck
        locator: "repo:doc-abc12345"
        description: "Q4 2025 Board Deck"

llamaindex:
  model: gpt-4o
  api_key: ${OPENAI_API_KEY}

computations:
  fields:
    - id: arr_summary
      label: "ARR Summary"
      docset_id: main_deck
      agents:
        - id: arr_extract
          prompt: |
            Extract ending ARR and NRR for the most recent quarter.
            Use basic_search: "End ARR NRR quarterly"
            Return null for any value not found.
          output_schema:
            type: object
            properties:
              end_arr: { type: number }
              nrr: { type: number }
              period: { type: string }
              citations: { type: array, items: { type: string } }
      mcp_scope: []
      prompt: "Return ARR summary with citations."

template:
  format: markdown
  content: |
    # {{report.name}} — {{context.as_of_period}}

    | Metric | Value |
    |--------|-------|
    | End ARR | {{ field.arr_summary.end_arr | currency("$", 0) | default("—") }} |
    | NRR     | {{ field.arr_summary.nrr | number(1) | default("—") }}% |
    | Period  | {{ field.arr_summary.period | default("—") }} |
```

---

## Full Annotated Example (Finance)

A production-quality configuration for a SaaS company CFO board pack. Covers all major patterns:

```yaml
schema_version: "2.2"

# ─── Report Identity ──────────────────────────────────────────────────────────
report:
  id: acme_cfo_kpi_q4_2025
  name: "Acme CFO KPI Pack — Q4 2025"
  description: |
    CFO-ready KPI extraction from the Q4 2025 Board Presentation.
    Covers ARR, retention, liquidity, bookings, and customer success.
  version: "2025.Q4"

# ─── Context Variables ────────────────────────────────────────────────────────
# These are injected into prompts as {{context.variable_name}}
context:
  company_name: "Acme Corp, Inc."
  currency: "USD"
  as_of_period: "CY2025 Q4"
  source_title: "Q4 2025 Acme Board Meeting Presentation"
  meeting_date: "2026-01-15"
  units_policy: |
    Return raw numeric values. No $, commas, or M/K suffixes.
    Convert: "$2.5M" → 2500000, "$350K" → 350000.
    Percentages as whole numbers (92.3, not 0.923).
  value_types:
    - "money_usd"
    - "percent"
    - "count"
    - "string"

# ─── Document Repository ──────────────────────────────────────────────────────
doc_repository:
  api_base_url: ${DOC_REPO_URL:-http://localhost:8080}
  api_key: ${DOC_REPO_API_KEY}
  rotation: 200

mcp: []    # No external system integrations in this example

# ─── Document Collections ─────────────────────────────────────────────────────
docsets:
  - id: acme_board_deck_q4
    description: "Acme Q4 2025 Board Deck — single source of truth"
    api_key: ${OPENAI_API_KEY}
    docs:
      - id: board_deck_pdf
        locator: "repo:doc-abc12345"
        description: "Q4 2025 Acme Board Meeting Presentation"

# ─── LLM & Agent Configuration ───────────────────────────────────────────────
llamaindex:
  model: gpt-4o
  base_url: ${OPENAI_BASE_URL:-https://api.openai.com/v1}
  api_key: ${OPENAI_API_KEY}
  max_tool_calls: 50
  tool_timeout_seconds: 180
  max_agent_iterations: 40
  system_prompt: |
    You are a CFO-grade KPI extraction analyst.

    ## ANTI-FABRICATION RULE
    ALL values MUST come from search tool results.
    Never use values from this prompt. Never guess. Return null if not found.

    ## Rules
    1. EXACT VALUES: Use values as found (raw numbers, not formatted)
    2. CITE EVERYTHING: Every numeric value needs a c_xxxxxxxx citation
    3. LABEL PERIODS: Include the time period with every metric
    4. NULL IS CORRECT: Return null for any value not explicitly in the source

# ─── Computations ─────────────────────────────────────────────────────────────
computations:
  fields:

    # ── ARR & Retention ───────────────────────────────────────────────────────
    - id: arr_snapshot
      label: "ARR & Retention Snapshot (Q4 2025)"
      type: object
      priority: 1
      docset_id: acme_board_deck_q4
      agents:
        - id: arr_extract
          # Autonomous mode — agent picks basic_search for tables
          prompt: |
            Extract the Q4 2025 ARR waterfall and retention metrics.

            ## What to Find
            From the "ARR & Logo Waterfall" table, Q4 2025 column:
            - beg: Beginning ARR for the quarter
            - new_logos: ARR added from new customers
            - net_upsell: Net expansion ARR (positive)
            - churn: ARR lost to churn (NEGATIVE number)
            - end: Ending ARR

            Retention metrics (bottom of same table or separate section):
            - nrr: Net Revenue Retention % (whole number, e.g. 92.3)
            - grr: Gross Revenue Retention % (whole number, e.g. 88.5)

            ## Search Strategy
            1. basic_search: "ARR waterfall Q4 2025 Beg ARR End ARR new logos churn"
            2. basic_search: "NRR GRR retention quarterly"
            3. Try multiple queries if first returns nothing

            ## CRITICAL
            Citations use [CITE AS: "c_xxxxxxxx"] format in search results.
            Retention must be whole-number scale (92.3 not 0.923).
            Churn must be negative (e.g. -81579).
          output_schema:
            type: object
            properties:
              period_label: { type: string }
              arr:
                type: object
                properties:
                  beg: { type: number }
                  new_logos: { type: number }
                  net_upsell: { type: number }
                  churn: { type: number }
                  end: { type: number }
              retention:
                type: object
                properties:
                  nrr: { type: number, minimum: 50, maximum: 150 }
                  grr: { type: number, minimum: 50, maximum: 100 }
              citations: { type: array, items: { type: string } }
              notes: { type: string }
      mcp_scope: []
      prompt: "Return Q4 2025 ARR waterfall and retention metrics with citations."

    # ── Liquidity & Runway ─────────────────────────────────────────────────────
    - id: liquidity_snapshot
      label: "Liquidity & Runway Snapshot"
      type: object
      priority: 1
      docset_id: acme_board_deck_q4
      agents:
        - id: liquidity_extract
          prompt: |
            Extract liquidity and runway metrics from the CFO report and cash forecast.

            ## Values to Find
            - cash_current: Current cash balance
            - monthly_burn: Monthly net cash burn
            - runway_months: Months of runway at current burn
            - gap_to_breakeven: Additional revenue needed for breakeven

            ## Unit Conversion — CRITICAL
            The deck uses "$X.XM" and "$XXXk" notation. Convert to full dollars:
            "$2.5M" → 2500000  |  "$350K" → 350000  |  "$7.3M" → 7300000

            ## Search Strategy
            1. basic_search: "cash balance runway breakeven monthly burn"
            2. basic_search: "cash forecast projected expense revenue run rate"
          output_schema:
            type: object
            properties:
              cash_current: { type: number }
              monthly_burn: { type: number }
              runway_months: { type: number }
              gap_to_breakeven: { type: number }
              citations: { type: array, items: { type: string } }
              notes: { type: string }
      mcp_scope: []
      prompt: "Return liquidity and runway snapshot with citations."

    # ── Executive Summary (depends on ARR + Liquidity) ─────────────────────────
    - id: executive_summary
      label: "Executive Summary (CFO-Ready)"
      type: object
      priority: 2
      depends_on: [arr_snapshot, liquidity_snapshot]   # runs AFTER these complete
      docset_id: acme_board_deck_q4
      agents:
        - id: exec_extract
          prompt: |
            Extract a CFO-ready executive summary from the board deck.

            ## What to Extract
            - highlights: 3-5 key performance bullets (wins, metrics vs plan)
            - risks: 2-4 operational or financial risks mentioned
            - asks: 1-3 board decisions or resource requests

            ## Search Strategy
            1. global_search: "strategic themes highlights performance"
            2. basic_search: "risks challenges board asks decisions"
            3. Every bullet MUST have citations from [CITE AS] markers

          output_schema:
            type: object
            properties:
              highlights:
                type: array
                items:
                  type: object
                  properties:
                    text: { type: string }
                    citations: { type: array, items: { type: string } }
              risks:
                type: array
                items:
                  type: object
                  properties:
                    text: { type: string }
                    citations: { type: array, items: { type: string } }
              asks:
                type: array
                items:
                  type: object
                  properties:
                    text: { type: string }
                    citations: { type: array, items: { type: string } }
      mcp_scope: []
      prompt: "Synthesize executive summary with highlights, risks, and asks."

  tables:
    # ── ARR Quarterly History ──────────────────────────────────────────────────
    - id: arr_quarterly_history
      title: "ARR & Logo Waterfall — Quarterly History"
      priority: 2
      docset_id: acme_board_deck_q4
      agents:
        - id: arr_history_extract
          prompt: |
            Extract the full quarterly ARR waterfall table (all periods shown).

            ## For EACH quarter in the table
            - period: Quarter label (e.g., "2024Q1", "2024Q2", ..., "2025Q4")
            - beg_arr, new_logos_arr, net_upsell_arr, churn_arr, end_arr (full dollar amounts)
            - nrr, grr (whole-number percentages, e.g. 92.3 not 0.923)

            ## MUST try multiple searches — the table is wide
            1. basic_search: "ARR waterfall quarterly Beg ARR End ARR" (k=10)
            2. basic_search: "2024Q1 2024Q2 ARR new logos churn" (k=10)
            3. Combine results to build the complete table

            ## VERIFY before returning
            - At least 3 quarters of data
            - End ARR values > $5,000,000 for recent quarters
            - NRR values between 80–120 (not 0.80–1.20)
            - Each row has at least one citation

            Return {"rows": [...]}
          output_schema:
            type: object
            properties:
              rows:
                type: array
                items:
                  type: object
                  properties:
                    period: { type: string }
                    beg_arr: { type: number }
                    new_logos_arr: { type: number }
                    net_upsell_arr: { type: number }
                    churn_arr: { type: number }
                    end_arr: { type: number }
                    nrr: { type: number, minimum: 50, maximum: 150 }
                    grr: { type: number, minimum: 50, maximum: 100 }
                    citations: { type: array, items: { type: string } }
      mcp_scope: []
      prompt: "Return quarterly ARR history with citations per row."

# ─── Output Template ──────────────────────────────────────────────────────────
template:
  format: markdown
  sections:
    report_header: |
      # {{report.name}}
      > **Source:** {{context.source_title}} | **Period:** {{context.as_of_period}}

  content: |
    {{sections.report_header}}

    ---

    ## Executive Summary

    ### Highlights
    {{ field.executive_summary.highlights | default("*No data extracted*") }}

    ### Risks
    {{ field.executive_summary.risks | default("*No data extracted*") }}

    ### Board Asks
    {{ field.executive_summary.asks | default("*No data extracted*") }}

    ---

    ## ARR & Retention (Q4 2025)

    **Period:** {{ field.arr_snapshot.period_label | default("N/A") }}

    ### ARR Waterfall
    | Metric | Value |
    |--------|-------|
    | Beg ARR | {{ field.arr_snapshot.arr.beg | currency("$", 0) | default("—") }} |
    | + New Logos | {{ field.arr_snapshot.arr.new_logos | currency("$", 0) | default("—") }} |
    | + Net Upsell | {{ field.arr_snapshot.arr.net_upsell | currency("$", 0) | default("—") }} |
    | − Churn | {{ field.arr_snapshot.arr.churn | currency("$", 0) | default("—") }} |
    | **End ARR** | **{{ field.arr_snapshot.arr.end | currency("$", 0) | default("—") }}** |

    ### Retention
    | Metric | Value |
    |--------|-------|
    | NRR | {{ field.arr_snapshot.retention.nrr | number(1) | default("—") }}% |
    | GRR | {{ field.arr_snapshot.retention.grr | number(1) | default("—") }}% |

    **Citations:** {{ field.arr_snapshot.citations | default("*None*") }}

    ### Quarterly ARR History
    {{table.arr_quarterly_history}}

    ---

    ## Liquidity & Runway

    | Metric | Value |
    |--------|-------|
    | Cash on Hand | {{ field.liquidity_snapshot.cash_current | currency("$", 0) | default("—") }} |
    | Monthly Burn | {{ field.liquidity_snapshot.monthly_burn | currency("$", 0) | default("—") }}/mo |
    | Runway | {{ field.liquidity_snapshot.runway_months | number(1) | default("—") }} months |
    | Gap to Breakeven | {{ field.liquidity_snapshot.gap_to_breakeven | currency("$", 0) | default("—") }} |

    **Citations:** {{ field.liquidity_snapshot.citations | default("*None*") }}

# ─── Guardrails ───────────────────────────────────────────────────────────────
guardrails:
  - id: gr_citation_completeness
    target: computations
    on_fail: warn
    model: gpt-4.1-mini
    api_key: ${OPENAI_API_KEY}
    description: "All numeric values must have citations"
    prompt: |
      Check that every numeric value has at least one citation (c_xxxxxxxx format).
      Empty citation arrays [] are failures.
      Return JSON: {"pass": boolean, "issues": ["list of fields missing citations"]}
      Content: {{content}}

  - id: gr_arr_waterfall_math
    target: field.arr_snapshot
    on_fail: warn
    model: gpt-4.1-mini
    api_key: ${OPENAI_API_KEY}
    description: "ARR bridge must add up correctly"
    prompt: |
      Validate: beg + new_logos + net_upsell + churn = end
      Churn is already negative — ADD it, don't subtract.
      Allow 1% tolerance for rounding.
      Return JSON: {"pass": boolean, "computed_end": number, "stated_end": number, "issues": []}
      Content: {{content}}

  - id: gr_fabrication_check
    target: computations
    on_fail: warn
    model: gpt-4.1-mini
    api_key: ${OPENAI_API_KEY}
    description: "Detect fabricated placeholder values"
    prompt: |
      FAIL if you find: citations like "Source A"/"Source B" (not c_xxxxxxxx),
      ALL dollar values as round multiples of 10000, or retention values below 1.0.
      Return JSON: {"pass": boolean, "issues": []}
      Content: {{content}}

  - id: gr_report_completeness
    target: final_report
    on_fail: warn
    model: gpt-4.1-mini
    api_key: ${OPENAI_API_KEY}
    description: "Final report must contain real data"
    prompt: |
      Check the report has actual numeric data (not just "—" everywhere).
      Return JSON: {"pass": boolean, "sections_populated": [], "sections_empty": [], "issues": []}
      Content: {{content}}

# ─── Execution Settings ────────────────────────────────────────────────────────
execution:
  retries:
    max_attempts: 3
    backoff_seconds: 2.0
  output:
    directory: ./output
    timestamp_suffix: false
    include_final_report: true
    include_computed_json: true
    include_evidence: true
    include_guardrails: true
```
