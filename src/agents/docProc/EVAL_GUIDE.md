# Nestbox Document Pipeline — Evaluation (Eval) Guide

The eval file lets you measure the quality of your pipeline configuration against a set of known questions and expected answers. It runs real queries against a processed document and scores the responses automatically using semantic similarity.

---

## Table of Contents

- [How Evaluation Works](#how-evaluation-works)
- [File Structure](#file-structure)
- [eval_params — Query Parameters](#eval_params--query-parameters)
- [Basic Search Test Cases](#basic-search-test-cases)
- [Local Search Test Cases](#local-search-test-cases)
- [Global Search Test Cases](#global-search-test-cases)
- [Writing Good expected_answer](#writing-good-expected_answer)
- [Writing Good bad_answer](#writing-good-bad_answer)
- [Scoring and Results](#scoring-and-results)
- [How Many Test Cases to Write](#how-many-test-cases-to-write)
- [Running Evaluations](#running-evaluations)
- [Interpreting Results](#interpreting-results)
- [Recommendations by Document Type](#recommendations-by-document-type)
- [Complete Example Eval Files](#complete-example-eval-files)

---

## How Evaluation Works

When you run an eval, the pipeline:

1. Submits each question to GraphRAG using the specified search mode (basic / local / global)
2. Receives a real response from the knowledge graph
3. Gets OpenAI embeddings for three texts: the **response**, your **expected_answer**, and your **bad_answer**
4. Computes cosine similarity: `sim_good` (response ↔ expected) and `sim_bad` (response ↔ bad)
5. Computes **delta** = `sim_good − sim_bad`
6. Classifies the result:
   - **GOOD** — delta ≥ 0.10 (response is meaningfully closer to your expected answer)
   - **BAD** — delta < 0.10 (response is not sufficiently better than the bad answer)
   - **ERROR** — query failed or response was empty

The evaluation is **semantic**, not keyword-based. The pipeline embeds the meaning of the response and compares it to the meaning of your expected and bad answers. This means exact wording doesn't matter — what matters is whether the response conveys the correct information.

**Key implication:** Your `expected_answer` should describe the correct information in natural language, and your `bad_answer` should describe a plausible but wrong or vague answer.

---

## File Structure

```yaml
# eval.yaml
eval_params:        # optional: query-level parameters per mode
  basic_search: ...
  local_search: ...
  global_search: ...

basic_search:       # simple factual retrieval test cases
  - question: "..."
    expected_answer: "..."
    bad_answer: "..."

local_search:       # entity-focused question test cases
  - question: "..."
    expected_answer: "..."
    bad_answer: "..."

global_search:      # summary and thematic question test cases
  - question: "..."
    expected_answer: "..."
    bad_answer: "..."
```

At least one of `basic_search`, `local_search`, or `global_search` must be present. You can include any combination.

---

## eval_params — Query Parameters

`eval_params` lets you override GraphRAG query parameters for all test cases in each mode. These are optional — defaults from your pipeline config apply if omitted.

```yaml
eval_params:
  basic_search:
    k: 10
    temperature: 0
    max_tokens: 4096

  local_search:
    top_k_entities: 20
    top_k_relationships: 20
    text_unit_prop: 0.5
    community_prop: 0.3
    max_context_tokens: 12000
    temperature: 0
    max_tokens: 4096

  global_search:
    max_context_tokens: 16000
    data_max_tokens: 12000
    map_max_length: 1000
    reduce_max_length: 2000
    dynamic_search_threshold: 1
    dynamic_search_keep_parent: true
    dynamic_search_num_repeats: 1
    dynamic_search_use_summary: false
    dynamic_search_max_level: 3
    temperature: 0
    max_tokens: 4096
```

### Basic Search Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `k` | 10 | Number of text chunks to retrieve by vector similarity |
| `temperature` | 0 | LLM temperature. Keep at 0 for deterministic eval results |
| `max_tokens` | 4096 | Maximum tokens in the response |

### Local Search Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `top_k_entities` | 10 | How many entity matches to retrieve. Increase to 20–30 for complex questions |
| `top_k_relationships` | 10 | How many relationship matches to retrieve |
| `text_unit_prop` | 0.5 | Proportion of context budget allocated to raw text units (0–1) |
| `community_prop` | 0.3 | Proportion of context budget allocated to community reports (0–1) |
| `conversation_history_max_turns` | 0 | For multi-turn conversations. Leave 0 for eval |
| `max_context_tokens` | 12000 | Total context window for the query |
| `temperature` | 0 | Keep at 0 for eval |
| `max_tokens` | 4096 | Maximum response length |

### Global Search Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_context_tokens` | 16000 | Total tokens available for community report context |
| `data_max_tokens` | 12000 | Token budget for the data portion |
| `map_max_length` | 1000 | Max response tokens per community in the map phase |
| `reduce_max_length` | 2000 | Max tokens for the final reduce/synthesis response |
| `dynamic_search_threshold` | 1 | Community rating threshold to include (0–10). Lower = include more communities |
| `dynamic_search_keep_parent` | true | Whether to include parent communities even when children qualify |
| `dynamic_search_num_repeats` | 1 | How many times to repeat community scoring for confidence |
| `dynamic_search_use_summary` | false | Use community summaries instead of full report text |
| `dynamic_search_max_level` | 3 | Maximum hierarchy depth to search (matches your `communities.maxLevels`) |
| `temperature` | 0 | Keep at 0 for eval |
| `max_tokens` | 4096 | Maximum response length |

**For eval runs always set `temperature: 0`** across all modes. Non-zero temperature introduces randomness that makes results inconsistent between runs.

---

## Basic Search Test Cases

Basic search is vector similarity retrieval — it finds the most relevant text chunks and uses them to answer the question. It does **not** use the knowledge graph entities or relationships.

**When to use basic search:**
- Simple factual lookups that are answered by a single sentence or paragraph
- Keyword-rich questions where the answer is likely verbatim in the document
- Testing whether the chunking and embedding pipeline captured a specific piece of information

**When NOT to use basic search:**
- Questions that require reasoning across multiple parts of the document
- Questions about relationships between entities
- Summary or thematic questions

**Question style:** Direct, specific, self-contained. The answer should exist in a single chunk.

```yaml
basic_search:
  - question: "What is the security deposit amount?"
    expected_answer: "The security deposit is $71,464.22 including HST."
    bad_answer: "There is no security deposit mentioned in the document."

  - question: "What OCR language is configured?"
    expected_answer: "The OCR engine is configured for English language recognition."
    bad_answer: "No language settings are specified."

  - question: "What is the building address?"
    expected_answer: "The building is located at 135 Yorkville Avenue, Toronto."
    bad_answer: "The document does not mention a specific address."
```

**Rules for basic_search questions:**

1. Ask about a single concrete fact (a number, a name, a date, a yes/no)
2. The answer must exist somewhere in the document text
3. Avoid "list all..." or "summarise..." — these belong in global_search
4. Avoid "how does X relate to Y" — these belong in local_search

---

## Local Search Test Cases

Local search traverses the knowledge graph — it retrieves entities, relationships, and community reports related to the question, then synthesises an answer. It is the most powerful mode for document Q&A.

**When to use local search:**
- Questions about specific entities and their properties
- Questions about relationships between parties or concepts
- Questions that require combining information from multiple places in the document
- Questions about obligations, rights, financial terms, timelines

**When NOT to use local search:**
- Very broad "tell me everything" questions (use global search)
- Questions where the answer is a single verbatim sentence (basic search may be faster)

**Question style:** Entity-focused, relational, specific but potentially spread across the document.

```yaml
local_search:
  - question: "What is the total minimum rent over the entire lease term?"
    expected_answer: "Over the 5-year term, minimum rent totals approximately $1,499,400: $291,060/year for Years 1-2 ($582,120), $301,840 in Year 3, and $312,620/year for Years 4-5 ($625,240)."
    bad_answer: "The rent is $135 per square foot."

  - question: "What are the tenant's insurance obligations?"
    expected_answer: "The tenant must maintain comprehensive general liability insurance of at least $5,000,000 per occurrence throughout the lease term."
    bad_answer: "The tenant has some insurance requirements."

  - question: "What are the conditions for exercising the extension option?"
    expected_answer: "The tenant may exercise up to two 5-year extension options by providing 180 days prior written notice to the landlord before the expiry of the current term."
    bad_answer: "There is an extension option available."

  - question: "Who is the guarantor and what are they guaranteeing?"
    expected_answer: "Bang & Olufsen A/S is the guarantor, guaranteeing all obligations of the tenant EPIC LUXURY SYSTEMS INC. under the lease, including rent payments and compliance with all lease terms."
    bad_answer: "Someone guarantees the lease."

  - question: "What happens in the event of a default?"
    expected_answer: "Upon default, the landlord may terminate the lease, re-enter the premises, and pursue damages. The tenant has a cure period of 10 days for monetary defaults and 30 days for non-monetary defaults."
    bad_answer: "Default has consequences for the tenant."
```

**Rules for local_search questions:**

1. Reference specific entity types from your config (parties, financial terms, dates, obligations)
2. Ask questions whose answers span multiple clauses or sections
3. The `expected_answer` should name specific entities with their values
4. The `bad_answer` should be a vague or incomplete version of the correct answer, not completely wrong — this tests whether the model extracts sufficient detail
5. Test both easy questions (parties, dates) and hard ones (cross-references, conditions)

**Testing relationship extraction quality:**

Local search results depend heavily on how well your entity extraction prompt captured relationships. Good test cases for this:

```yaml
local_search:
  # Tests that rent escalation relationships were captured
  - question: "How does the minimum rent change over the lease term?"
    expected_answer: "Minimum rent starts at $135/sqft ($291,060/year) for Years 1-2, increases to $140/sqft ($301,840/year) in Year 3, then to $145/sqft ($312,620/year) for Years 4-5."
    bad_answer: "The rent increases over time."

  # Tests that party-obligation relationships were captured
  - question: "What are the landlord's maintenance obligations?"
    expected_answer: "The landlord is responsible for maintaining the structural elements of the building, roof, common areas, and building systems including HVAC, plumbing, and electrical not within the premises."
    bad_answer: "The landlord has some maintenance duties."
```

---

## Global Search Test Cases

Global search uses community reports — summaries of entity clusters built during indexing — to answer broad, thematic questions about the document. It does not look at individual entity details but synthesises across communities.

**When to use global search:**
- "Summarise all..." questions
- "What are the main themes..." questions
- "List all obligations/rights/financial terms..."
- Questions that require awareness of the full document scope
- Portfolio-level questions when multiple documents were indexed together

**When NOT to use global search:**
- Specific factual lookups (use basic or local)
- Questions about exact values (local search is more precise)
- Short documents with few entities (local search works better)

**Question style:** Broad, thematic, synthesis-oriented.

```yaml
global_search:
  - question: "Summarise all financial obligations of the tenant under this lease."
    expected_answer: "The tenant's financial obligations include: Minimum Rent starting at $291,060/year ($135/sqft) escalating to $312,620/year ($145/sqft); Additional Rent covering operating costs and property taxes; a Security Deposit of $71,464.22; HST on all payments; and liability insurance of at least $5,000,000."
    bad_answer: "The tenant must pay rent and other fees."

  - question: "What are all the key dates and time periods in this lease?"
    expected_answer: "Key dates include: Commencement Date January 15 2026; Fixturing Period of 60 days preceding commencement; initial 5-year Term expiring January 14 2031; two 5-year extension options potentially running to 2041; and various notice periods (180 days for extension, 90 days for termination)."
    bad_answer: "The lease starts in 2026 and lasts 5 years."

  - question: "What rights does the tenant have under this lease?"
    expected_answer: "The tenant holds the following rights: two 5-year extension options exercisable with 180 days notice; a right of first refusal on adjacent space; a termination right if the premises are damaged beyond 50% and not restored within 180 days; and a right to sublet with landlord consent not to be unreasonably withheld."
    bad_answer: "The tenant has some rights to extend the lease."

  - question: "What are the landlord's and tenant's respective maintenance responsibilities?"
    expected_answer: "The landlord maintains structural elements, roof, common areas, and building systems (HVAC, plumbing, electrical) outside the premises. The tenant is responsible for all interior non-structural maintenance, interior finishes, fixtures, signage, and HVAC equipment serving only the premises."
    bad_answer: "Both parties have maintenance obligations."
```

**Rules for global_search questions:**

1. Questions should genuinely require synthesising across the full document
2. `expected_answer` should be a mini-summary — it can be multi-sentence
3. `bad_answer` should be a shallow or incomplete version: "The tenant has some responsibilities" vs. "The tenant must pay $X, maintain Y, and comply with Z"
4. Avoid questions whose answers come from a single paragraph — those belong in local or basic
5. Include "list all..." and "summarise all..." framing — this is where global search excels
6. Test the quality of your community reports (these are what global search draws from)

---

## Writing Good expected_answer

The `expected_answer` is used as the "gold standard" for semantic similarity comparison. The pipeline embeds it and measures how close the GraphRAG response is to it.

**Principles:**

### 1. Include the actual values

Bad (too vague — similar to a bad answer):
```yaml
expected_answer: "The tenant pays rent to the landlord."
```

Good (specific values anchor the semantic comparison):
```yaml
expected_answer: "The tenant pays minimum rent of $135.00 per square foot ($291,060 annually) for Years 1-2, escalating to $145.00/sqft ($312,620 annually) for Years 4-5."
```

### 2. Match the scope of the question

If the question asks about one thing, the `expected_answer` should cover one thing well, not everything tangentially related.

```yaml
question: "What is the security deposit?"
expected_answer: "The security deposit is $71,464.22 including HST, held by the landlord to secure the tenant's obligations under the lease."
# Don't add: "The tenant also pays $291,060/year in rent..." — out of scope
```

### 3. Use natural language, not bullet points

The embedding model handles prose better than structured lists for similarity comparison.

```yaml
# Less effective
expected_answer: |
  - Rent: $291,060
  - Deposit: $71,464.22
  - Insurance: $5,000,000

# More effective
expected_answer: "The tenant's main financial obligations are minimum rent of $291,060 annually, a security deposit of $71,464.22, and comprehensive liability insurance of $5,000,000 per occurrence."
```

### 4. Write it as a complete answer, not a description of the answer

```yaml
# Wrong — describes what the answer is, not the answer itself
expected_answer: "A dollar amount for the rent is stated."

# Correct — is the answer
expected_answer: "The minimum rent is $135.00 per square foot per annum, totalling $291,060.00 annually for Years 1 and 2."
```

### 5. For global search, write a comprehensive summary

Global search synthesises across the document. The `expected_answer` should reflect that breadth:

```yaml
# Too narrow for a global question
question: "Summarise all tenant financial obligations."
expected_answer: "The tenant pays $291,060 in rent."

# Appropriate for global
expected_answer: "Tenant financial obligations encompass minimum rent escalating from $291,060 to $312,620 annually over five years, additional rent covering proportionate operating costs and taxes, a security deposit of $71,464.22, HST on all amounts, and maintenance of $5,000,000 liability insurance."
```

---

## Writing Good bad_answer

The `bad_answer` defines the lower bound of the similarity comparison. A response must be meaningfully closer to `expected_answer` than to `bad_answer` (by at least 10%) to be classified as GOOD.

**The bad_answer should be:**
- Plausible-sounding but wrong or incomplete
- Not obviously nonsensical (if it's too different from everything, it doesn't provide contrast)
- The type of answer a poorly-configured pipeline or a hallucinating LLM might give

**Common bad_answer patterns:**

### Pattern 1: Vague / Non-committal
```yaml
# For a question about rent
bad_answer: "The tenant is required to make regular payments to the landlord."
```

### Pattern 2: "Not found" / Empty
```yaml
bad_answer: "The document does not contain information about this topic."
```
Use this when the expected_answer is a specific value — a "not found" response is clearly bad.

### Pattern 3: Wrong value / Plausibly wrong
```yaml
# For a question about the security deposit
bad_answer: "The security deposit is three months' rent, held in escrow by the landlord."
# (Plausible but wrong — actual is a specific dollar amount, not formula-based)
```

### Pattern 4: Incomplete — right topic, missing the key detail
```yaml
# For a question about extension options
bad_answer: "The tenant has the option to extend the lease beyond the initial term."
# Missing: number of options, duration, notice period requirements
```

Pattern 4 is often the most useful because it tests whether the model extracts **sufficient detail**, not just whether it found the right topic.

### Pattern 5: Off-topic but superficially related
```yaml
# For a question about landlord maintenance obligations
bad_answer: "The tenant is responsible for all maintenance and repairs within the premises."
# Right topic (maintenance) but wrong party
```

**Avoid:**
- Completely unrelated answers ("The sky is blue") — too easy, doesn't test the model
- Answers that are identical to the expected answer — delta will be ~0
- Answers that are more complete than the expected_answer — the model could reasonably score higher on the bad answer

---

## Scoring and Results

### Per-question metrics

| Metric | Description |
|--------|-------------|
| `similarityToGood` | Cosine similarity (0–1) between the response and `expected_answer`. Higher is better. |
| `similarityToBad` | Cosine similarity (0–1) between the response and `bad_answer`. Lower is better. |
| `deltaScore` | `similarityToGood − similarityToBad`. Must be ≥ 0.10 to classify as GOOD. |
| `classification` | GOOD / BAD / ERROR |

**Example result breakdown:**

```
question: "What is the security deposit?"
graphragResponse: "The security deposit is $71,464.22 including HST, per Section 4.3 of the lease."
similarityToGood: 0.9241   (very close to expected answer)
similarityToBad:  0.4823   (clearly different from bad answer)
deltaScore:       0.4418   ✓ GOOD (well above 0.10 threshold)
```

```
question: "What are the operating cost escalations?"
graphragResponse: "The tenant pays a proportionate share of operating costs, subject to annual adjustment."
similarityToGood: 0.7234
similarityToBad:  0.6891
deltaScore:       0.0343   ✗ BAD (below 0.10 — response too vague, close to bad answer)
```

### Summary metrics

| Metric | Description |
|--------|-------------|
| `accuracy` | Proportion of GOOD results among non-ERROR results |
| `avgDeltaScore` | Average delta across all test cases. Higher = better overall quality |
| `avgSimilarityToGood` | Average cosine similarity to expected answers |
| `avgSimilarityToBad` | Average cosine similarity to bad answers |
| `f1Score` | Harmonic mean of precision and recall for classification |

### Interpreting delta scores

| avgDeltaScore | Interpretation |
|---------------|---------------|
| > 0.40 | Excellent — responses are strongly aligned with expected answers |
| 0.25–0.40 | Good — solid extraction and retrieval |
| 0.10–0.25 | Acceptable — passing threshold but room for improvement |
| 0.05–0.10 | Borderline — many BAD results, review entity/prompt config |
| < 0.05 | Poor — responses are barely distinguishable from bad answers |

---

## How Many Test Cases to Write

| Document Type | basic_search | local_search | global_search | Total |
|--------------|-------------|-------------|--------------|-------|
| Short contract (< 20 pages) | 3–5 | 8–12 | 3–5 | 15–22 |
| Long contract (20–100 pages) | 5–8 | 15–20 | 5–8 | 25–36 |
| Multi-document collection | 5–10 | 15–25 | 8–15 | 30–50 |
| Technical manual | 5–10 | 10–15 | 3–5 | 18–30 |
| Financial report | 3–5 | 12–18 | 5–10 | 20–33 |

**Minimum recommended:** 5 local_search cases. This is the highest-signal mode for documents with a configured knowledge graph.

**Distribution principle:** Allocate most test cases to the mode you rely on most in production. If you mostly use local search for Q&A, weight your eval there.

**Coverage principle:** Each entity type in your config should appear in at least one test case. If you defined `EXTENSION_OPTION` as an entity type, write a local_search question that requires it.

---

## Running Evaluations

```bash
# Validate your eval file before running
nestdoc eval validate --file ./eval.yaml --verbose

# Run evaluation against a processed document
nestdoc eval run --document doc-abc123 --test-file ./eval.yaml --watch

# Run and save results to file
nestdoc eval run --document doc-abc123 --test-file ./eval.yaml --watch --save --output ./results.json

# Check progress of a running eval
nestdoc eval status --eval eval-abc123

# View detailed results
nestdoc eval results --document doc-abc123 --eval eval-abc123 --show-details

# Generate a report
nestdoc eval report --document doc-abc123 --eval eval-abc123 --format markdown

# Compare two pipeline configs (run evals on both, then compare)
nestdoc eval compare --document doc-abc123 --eval-a eval-aaa111 --eval-b eval-bbb222
```

---

## Interpreting Results

### If accuracy is low on basic_search

- The document text was not captured correctly by Docling (OCR issue, wrong layout model)
- Chunks are too small and the relevant sentence was split across two chunks
- The answer exists in a table or image that wasn't extracted
- **Fix:** Review Docling config — try a stronger layout model or enable/improve OCR

### If accuracy is low on local_search

Most common cause: entity extraction is missing entities or relationships.

- Check that your entity types match what you're asking about
- Review the entity extraction prompt — add more examples for the failing question types
- Increase `maxGleanings` to 1 or 2
- Increase `top_k_entities` in `eval_params.local_search` to 20–30
- If specific values (dollar amounts, dates) are missing, check that your prompt includes instructions to include values in entity names

### If accuracy is low on global_search

- Community detection is not grouping related entities together
- Community reports are not detailed enough
- **Fix:** Increase `communityReports.maxLength`, improve the community report prompt
- Try reducing `dynamic_search_threshold` to 0 or 1 (include more communities)
- Increase `max_context_tokens` in `eval_params.global_search`

### If deltaScore is near 0 for many cases

- Your `expected_answer` and `bad_answer` may be too similar to each other
- Or the model is returning very generic responses that don't commit to either
- **Fix:** Make `expected_answer` more specific (add exact values), make `bad_answer` more vague

### If all results are BAD but responses look reasonable

- Check your `expected_answer` — it might be asking for information that is genuinely not in the document
- Or the question is in the wrong mode (e.g. a summary question in basic_search)
- Try increasing `top_k_entities` or `max_context_tokens`

---

## Recommendations by Document Type

### Commercial Leases / Contracts

```yaml
eval_params:
  local_search:
    top_k_entities: 20
    top_k_relationships: 20
    max_context_tokens: 16000
    temperature: 0
  global_search:
    dynamic_search_threshold: 1
    max_context_tokens: 16000
    temperature: 0

basic_search:
  # Test verbatim value extraction
  - question: "What is the rentable area of the premises?"
    expected_answer: "The rentable area is approximately 2,156 square feet."
    bad_answer: "The premises is a retail unit."

local_search:
  # Test financial entity extraction
  - question: "What are the minimum rent amounts and how do they escalate over the lease term?"
    expected_answer: "Minimum rent is $135.00/sqft ($291,060/year) for Years 1-2, $140.00/sqft ($301,840/year) in Year 3, and $145.00/sqft ($312,620/year) for Years 4-5, all plus HST."
    bad_answer: "Rent increases over time."

  # Test relationship extraction between parties and obligations
  - question: "Who are the parties to the lease and what are their primary obligations?"
    expected_answer: "YORKVILLE OFFICE RETAIL CORPORATION is the Landlord, obligated to deliver and maintain the premises. EPIC LUXURY SYSTEMS INC. o/a BANG & OLUFSEN is the Tenant, obligated to pay minimum and additional rent, maintain the interior, and comply with use restrictions. BANG & OLUFSEN A/S is the Guarantor."
    bad_answer: "There is a landlord and a tenant."

  # Test notice/condition chain
  - question: "What notice is required to exercise the extension option and when must it be given?"
    expected_answer: "The tenant must give 180 days prior written notice to exercise an extension option, before the expiry of the current term or option period."
    bad_answer: "The tenant must give advance notice to extend."

global_search:
  # Test community synthesis of all financial terms
  - question: "Provide a complete summary of all financial terms in this lease."
    expected_answer: "Financial terms include: Minimum Rent of $291,060–$312,620/year escalating over 5 years; Additional Rent covering proportionate share of operating costs and taxes; Security Deposit of $71,464.22 including HST; liability insurance requirement of $5,000,000; and all payments are subject to HST."
    bad_answer: "The tenant pays rent and other charges."
```

### Financial Reports

```yaml
eval_params:
  local_search:
    top_k_entities: 25
    max_context_tokens: 16000
    temperature: 0
  global_search:
    dynamic_search_threshold: 0
    max_context_tokens: 20000
    temperature: 0

basic_search:
  - question: "What was total revenue for the fiscal year?"
    expected_answer: "Total revenue for the fiscal year was $4.2 billion, a 12% increase year-over-year."
    bad_answer: "Revenue information is not available."

local_search:
  - question: "What are the primary risk factors identified in the report?"
    expected_answer: "The report identifies three primary risk factors: interest rate sensitivity affecting the loan portfolio by approximately $45M per 100bps movement; concentration risk with the top 10 clients representing 38% of revenue; and regulatory compliance risk from pending Basel IV implementation."
    bad_answer: "The company faces various risks."

global_search:
  - question: "Summarise the company's financial performance and outlook."
    expected_answer: "Revenue grew 12% to $4.2B driven by commercial lending expansion. Net income increased 8% to $620M. The outlook projects 8–10% revenue growth supported by the acquisition of three regional banks. Key risks include interest rate exposure and regulatory changes."
    bad_answer: "The company performed well and expects continued growth."
```

### Technical Documentation

```yaml
eval_params:
  basic_search:
    k: 15
    temperature: 0
  local_search:
    top_k_entities: 15
    max_context_tokens: 12000
    temperature: 0

basic_search:
  - question: "What is the maximum payload size for the upload endpoint?"
    expected_answer: "The upload endpoint accepts a maximum payload of 100MB per request."
    bad_answer: "There are limits on file upload sizes."

local_search:
  - question: "What authentication methods does the API support?"
    expected_answer: "The API supports three authentication methods: API key via Authorization header, OAuth 2.0 Bearer tokens with 1-hour expiry, and HMAC-SHA256 request signing for server-to-server calls."
    bad_answer: "The API requires authentication."

  - question: "What are the rate limits and how are they enforced?"
    expected_answer: "Rate limits are 1,000 requests per minute per API key and 10,000 per day. Exceeded limits return HTTP 429 with a Retry-After header. Enterprise accounts have custom limits."
    bad_answer: "There are rate limits on API usage."

global_search:
  - question: "What are all the error codes documented and what do they mean?"
    expected_answer: "Documented error codes include: 400 Bad Request for invalid parameters; 401 Unauthorized for missing/invalid API key; 403 Forbidden for insufficient permissions; 404 Not Found for missing resources; 429 Too Many Requests for rate limit exceeded; 500 Internal Server Error for system failures; and 503 Service Unavailable during maintenance."
    bad_answer: "The API returns standard HTTP error codes."
```

---

## Complete Example Eval Files

### Minimal eval file

```yaml
local_search:
  - question: "Who are the landlord and tenant in this lease?"
    expected_answer: "The landlord is YORKVILLE OFFICE RETAIL CORPORATION and the tenant is EPIC LUXURY SYSTEMS INC. operating as Bang & Olufsen."
    bad_answer: "There is a landlord and tenant named in the document."
```

---

### Full commercial lease eval file

```yaml
eval_params:
  basic_search:
    k: 10
    temperature: 0
    max_tokens: 2048

  local_search:
    top_k_entities: 20
    top_k_relationships: 20
    text_unit_prop: 0.5
    community_prop: 0.3
    max_context_tokens: 16000
    temperature: 0
    max_tokens: 4096

  global_search:
    max_context_tokens: 16000
    dynamic_search_threshold: 1
    dynamic_search_keep_parent: true
    temperature: 0
    max_tokens: 4096

# ---------------------------------------------------------------------------
# BASIC SEARCH — simple factual lookups from document text
# ---------------------------------------------------------------------------
basic_search:
  - question: "What is the rentable area of the leased premises?"
    expected_answer: "The rentable area is approximately 2,156 square feet."
    bad_answer: "The premises size is not specified."

  - question: "What is the address of the leased property?"
    expected_answer: "The property is located at 135 Yorkville Avenue, Toronto, Ontario."
    bad_answer: "The document contains a property address somewhere."

  - question: "What is the security deposit amount?"
    expected_answer: "The security deposit is $71,464.22 including HST."
    bad_answer: "A security deposit is required but the amount is not mentioned."

  - question: "What is the fixturing period length?"
    expected_answer: "The tenant receives a 60-day fixturing period prior to the commencement date for tenant improvements, during which no minimum rent is payable."
    bad_answer: "There is a period before the lease starts for the tenant to prepare."

  - question: "What insurance coverage amounts are required?"
    expected_answer: "The tenant must maintain comprehensive general liability insurance of not less than $5,000,000 per occurrence."
    bad_answer: "The tenant must have insurance."

# ---------------------------------------------------------------------------
# LOCAL SEARCH — entity and relationship focused questions
# ---------------------------------------------------------------------------
local_search:
  - question: "Who are the parties to this lease agreement?"
    expected_answer: "The parties are: YORKVILLE OFFICE RETAIL CORPORATION as Landlord; EPIC LUXURY SYSTEMS INC. o/a BANG & OLUFSEN as Tenant; and BANG & OLUFSEN A/S as Guarantor guaranteeing the tenant's obligations."
    bad_answer: "There is a landlord and a tenant in this agreement."

  - question: "What are the minimum rent amounts for each year of the lease term?"
    expected_answer: "Minimum rent is $135.00 per square foot ($291,060.00 annually, $24,255.00 monthly) for Years 1–2; $140.00 per square foot ($301,840.00 annually) for Year 3; and $145.00 per square foot ($312,620.00 annually) for Years 4–5. All amounts are plus HST."
    bad_answer: "The rent increases each year over the course of the lease."

  - question: "What are the tenant's extension rights and what are the conditions to exercise them?"
    expected_answer: "The tenant has two options to extend the lease term for five years each, exercisable by providing 180 days prior written notice before expiry of the then-current term, provided the tenant is not in default and has not assigned or sublet the premises."
    bad_answer: "The tenant can potentially extend the lease."

  - question: "What is the commencement date and when does the lease expire?"
    expected_answer: "The lease commences on January 15, 2026, following a 60-day fixturing period. The initial 5-year term expires on January 14, 2031. If both extension options are exercised, the lease could run until January 14, 2041."
    bad_answer: "The lease starts in 2026 and runs for 5 years."

  - question: "What use restrictions apply to the premises?"
    expected_answer: "The premises may only be used for the retail sale of luxury consumer electronics and related accessories under the Bang & Olufsen brand. Any change of use or co-tenancy requires prior written consent of the landlord."
    bad_answer: "The tenant must use the space for its business."

  - question: "What maintenance obligations does the tenant have?"
    expected_answer: "The tenant is responsible for maintaining the interior of the premises in good repair, including all non-structural elements, interior finishes, fixtures, tenant's equipment, HVAC units serving only the premises, and signage. The tenant must redecorate every five years."
    bad_answer: "The tenant must keep the premises in good condition."

  - question: "What are the events of default and what cure periods apply?"
    expected_answer: "Events of default include: failure to pay rent (10-day cure period after written notice); breach of any non-monetary obligation (30-day cure period, or such longer period as reasonably required); insolvency or bankruptcy of the tenant; and abandonment of the premises."
    bad_answer: "Non-payment of rent and other breaches are defaults."

  - question: "What additional rent components does the tenant pay?"
    expected_answer: "Additional rent includes: the tenant's proportionate share (approximately 4.2%) of building operating costs; proportionate share of property and realty taxes; utility charges for the premises; HVAC maintenance costs; and waste removal charges."
    bad_answer: "The tenant pays more than just base rent."

  - question: "What are the landlord's obligations regarding the building and common areas?"
    expected_answer: "The landlord must maintain the structural elements of the building, roof, exterior walls, common areas, and building systems (HVAC, plumbing, electrical) serving areas beyond the premises. The landlord must keep common areas clean and in good repair."
    bad_answer: "The landlord is responsible for some building maintenance."

  - question: "What happens to the lease if the premises are damaged or destroyed?"
    expected_answer: "If the premises are damaged, the landlord must restore them within 180 days unless the damage affects more than 50% of the building, in which case the landlord may terminate the lease on 60 days notice. If restoration takes more than 180 days, the tenant may terminate."
    bad_answer: "Damage provisions are addressed in the lease."

# ---------------------------------------------------------------------------
# GLOBAL SEARCH — thematic and summary questions
# ---------------------------------------------------------------------------
global_search:
  - question: "Provide a complete financial summary of this commercial lease including all costs the tenant must pay."
    expected_answer: "The tenant's total financial obligations include: minimum rent escalating from $291,060/year ($135/sqft) in Years 1-2 to $312,620/year ($145/sqft) in Years 4-5; proportionate share (4.2%) of operating costs and property taxes as additional rent; a security deposit of $71,464.22 including HST; annual HVAC maintenance; and a comprehensive general liability insurance requirement of $5,000,000 per occurrence. All monetary amounts are subject to HST."
    bad_answer: "The tenant must pay rent and various fees over the lease term."

  - question: "Summarise all rights the tenant holds under this lease."
    expected_answer: "The tenant's rights include: two 5-year extension options (180 days notice required); a right of first refusal on adjacent available space; a termination right if the premises are not restored within 180 days after damage; a co-tenancy right permitting rent reduction if anchor tenants vacate; and a right to sublet or assign with landlord consent not to be unreasonably withheld."
    bad_answer: "The tenant has various rights regarding the lease term and property use."

  - question: "What are the key terms and timeline of this lease from start to finish?"
    expected_answer: "Timeline: 60-day fixturing period (November 16 – January 14 2026, rent-free for minimum rent); Commencement January 15 2026; initial 5-year term expiring January 14 2031; First extension option to January 14 2036; Second extension option to January 14 2041. Rent escalates in three steps. 180-day notice required for extension. 90-day notice required for termination where applicable."
    bad_answer: "The lease runs for five years starting in 2026 with options to extend."

  - question: "What obligations does each party have under this lease?"
    expected_answer: "Landlord obligations: deliver premises in shell condition; maintain structure, roof, common areas, and building systems; provide parking; remedy defaults within 30 days notice. Tenant obligations: pay minimum and additional rent; maintain interior; carry $5M liability insurance; restrict use to luxury electronics retail; not assign without consent; redecorate every 5 years; restore premises on expiry. Guarantor: guarantee all tenant obligations unconditionally."
    bad_answer: "The landlord and tenant each have obligations to perform under the agreement."
```

---

*For schema reference, see: `packages/nest-doc-processing-cli/src/schemas/eval-test-cases.schema.yaml`*
*To generate a blank template: `nestdoc eval init --output ./eval.yaml`*
