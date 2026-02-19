# Nestbox Document Pipeline — Configuration Guide

This guide explains every option in the pipeline configuration file (profile), with recommendations for each setting based on document type and use case.

The config file is a single YAML file that controls three stages of the pipeline:

1. **Docling** — document extraction (PDF/DOCX → structured text, tables, images)
2. **Chunking** — text segmentation for RAG
3. **GraphRAG** — knowledge graph construction for semantic search and Q&A

---

## Table of Contents

- [Quick Start](#quick-start)
- [File Structure](#file-structure)
- [Docling — Document Extraction](#docling--document-extraction)
  - [Layout Model](#layout-model)
  - [OCR Engine](#ocr-engine)
  - [Tables](#tables)
  - [Pictures](#pictures)
  - [Accelerator](#accelerator)
  - [Limits](#limits)
- [Chunking — Text Segmentation](#chunking--text-segmentation)
  - [Strategy](#strategy)
  - [Token Sizes](#token-sizes)
  - [Metadata](#metadata)
- [GraphRAG — Knowledge Graph](#graphrag--knowledge-graph)
  - [Models](#models)
  - [Entity Types](#entity-types)
  - [Writing the Entity Extraction Prompt](#writing-the-entity-extraction-prompt)
  - [Relationships](#relationships)
  - [Summarize Descriptions](#summarize-descriptions)
  - [Claim Extraction](#claim-extraction)
  - [Community Detection](#community-detection)
  - [Community Reports Prompt](#community-reports-prompt)
  - [Local Search](#local-search)
  - [Global Search](#global-search)
  - [DRIFT Search](#drift-search)
  - [Clustering & Cache](#clustering--cache)
- [API Keys](#api-keys)
- [Recommendations by Document Type](#recommendations-by-document-type)
- [Complete Example Configs](#complete-example-configs)

---

## Quick Start

The minimum valid config requires only a `name`:

```yaml
name: "My Pipeline"
```

Everything else defaults to sensible values. To customise for your domain, at minimum change:

1. `graphrag.entityExtraction.entityTypes` — what concepts to extract
2. `graphrag.entityExtraction.prompt` — instructions for the LLM
3. `docling.layout.model` — based on your hardware and document quality
4. `docling.ocr.engine` — whether documents are digital or scanned

---

## File Structure

```yaml
name: "..."               # required
description: "..."        # optional

docling:
  layout: ...
  ocr: ...
  tables: ...
  pictures: ...
  accelerator: ...
  limits: ...

chunking:
  strategy: ...
  maxTokens: ...
  overlapTokens: ...
  tokenizer: ...
  mergePeers: ...
  contextualize: ...
  output: ...
  metadata: ...

graphrag:
  enabled: true
  models: ...
  entityExtraction: ...
  summarizeDescriptions: ...
  claimExtraction: ...
  communities: ...
  communityReports: ...
  embeddings: ...
  localSearch: ...
  globalSearch: ...
  driftSearch: ...
  clusterGraph: ...
  cache: ...

apiKeys:
  openai: ${OPENAI_API_KEY}
```

---

## Docling — Document Extraction

Docling converts your source documents (PDF, DOCX, HTML, PPTX, Markdown) into structured JSON and Markdown with extracted tables and figures.

### Layout Model

The layout model detects document structure: headings, paragraphs, tables, figures, columns.

```yaml
docling:
  layout:
    model: docling-layout-egret-large   # default
    createOrphanClusters: true
    keepEmptyClusters: true
```

| Model | GPU Memory | Speed | Accuracy | When to Use |
|-------|-----------|-------|----------|-------------|
| `docling-layout-heron` | ~2 GB | Fastest | Good | High volume, simple documents (plain text PDFs, single-column articles) |
| `docling-layout-heron-101` | ~2 GB | Fast | Better | Simple documents where heron is insufficient |
| `docling-layout-egret-medium` | ~4 GB | Medium | High | Balanced choice for most office documents |
| `docling-layout-egret-large` | ~6 GB | Slower | Highest | **Default. Best for complex layouts: multi-column, mixed tables/text, legal docs** |
| `docling-layout-egret-xlarge` | ~10 GB | Slowest | Best | Dense academic papers, financial reports with complex tables, maximum accuracy needed |

**Recommendations by document type:**

- **Commercial leases, contracts** → `egret-large` (complex formatting, tables, multi-column)
- **Scanned old documents** → `egret-large` or `egret-xlarge` (needs best layout detection to assist OCR)
- **Simple text PDFs / reports** → `egret-medium` or `heron` (faster processing)
- **Academic papers with equations** → `egret-xlarge`
- **High-volume batch processing** → `heron` or `heron-101` (trade accuracy for throughput)

**Other layout options:**

- `createOrphanClusters: true` — groups floating text elements (headers, footers, captions) into clusters. Recommended: keep `true`.
- `keepEmptyClusters: true` — preserves empty structural elements for layout fidelity. Recommended: keep `true`.

---

### OCR Engine

OCR is used when documents contain scanned pages or images rather than selectable text.

```yaml
docling:
  ocr:
    enabled: true
    engine: rapidocr         # rapidocr | tesseract | easyocr | mac
    backend: torch           # torch | onnx | cpu
    languages: [en]
    textScore: 0.5
    forceFullPageOcr: true
```

| Engine | Backend | Speed | Multi-Language | Best For |
|--------|---------|-------|---------------|----------|
| `rapidocr` | `torch` / `onnx` | Fast | Limited | **Default. GPU-accelerated, excellent for English documents** |
| `rapidocr` | `onnx` | Medium | Limited | CPU-only servers, Docker deployments without GPU |
| `tesseract` | `cpu` | Slow | Very good | Legacy systems, broad language support, well-known engine |
| `easyocr` | `torch` | Medium | Excellent | Documents with multiple languages, Asian scripts, mixed content |
| `mac` | native | Fast | Good | macOS development environments only |

**Recommendations:**

- **English business documents on GPU server** → `engine: rapidocr`, `backend: torch`
- **CPU-only deployment** → `engine: rapidocr`, `backend: onnx`
- **Documents with French, Spanish, German, etc.** → `engine: easyocr`, add languages: `[en, fr]`
- **Japanese, Chinese, Arabic scripts** → `engine: easyocr`, add the relevant language codes
- **macOS development** → `engine: mac`

**Key parameters:**

- `textScore` (0–1): Confidence threshold for accepting detected text. Lower (0.3) = accept more text but more noise. Higher (0.7) = stricter. **Recommended: 0.5 for most documents, 0.3 for poor quality scans.**
- `forceFullPageOcr: true`: Process the entire page even when digital text is detected. Use when documents mix selectable text and scanned images. Set to `false` for pure digital PDFs to speed up processing.
- `languages`: ISO codes. Examples: `[en]`, `[en, fr]`, `[en, zh]`

**When to disable OCR:**

Set `enabled: false` only for fully digital PDFs with selectable text. This significantly speeds up processing.

```yaml
ocr:
  enabled: false   # pure digital PDFs only
```

---

### Tables

```yaml
docling:
  tables:
    enabled: true
    mode: accurate       # accurate | fast
    doCellMatching: true
```

- `mode: accurate` — uses a more thorough table recognition algorithm. **Always recommended** unless processing speed is critical.
- `mode: fast` — quicker but may miss table structure in complex tables (merged cells, nested headers).
- `doCellMatching: true` — matches detected cells to the table grid structure. Keep `true` for structured output.

**When to use `fast`:** Simple tables, high-volume processing where table accuracy is secondary.
**When to use `accurate`:** Financial statements, lease schedules, data-heavy reports.

---

### Pictures

```yaml
docling:
  pictures:
    enabled: true
    enableClassification: true
    enableDescription: true
    descriptionProvider: openai     # openai | local
    descriptionModel: gpt-4o        # gpt-4o | gpt-4o-mini
    imagesScale: 2.0
    descriptionPrompt: |
      Describe this image...
```

- `enabled: false` — skip all image processing (fastest, use when documents have no relevant images)
- `enableClassification` — classifies each image as chart, diagram, floor plan, photo, etc.
- `enableDescription` — uses a vision LLM to generate a text description of each image, making images searchable
- `descriptionModel`:
  - `gpt-4o` — highest quality descriptions, more expensive
  - `gpt-4o-mini` — good quality, significantly cheaper (recommended for most cases)
- `imagesScale` (0.1–4.0): Resolution multiplier for image extraction. Higher = better quality but larger files.
  - `1.0` — original resolution
  - `2.0` — **default, good balance**
  - `3.0–4.0` — for documents with fine details (architectural drawings, technical schematics)

**Custom description prompt:**

The `descriptionPrompt` tells the vision model how to describe images. Write it based on what images appear in your documents:

```yaml
# For property/real estate documents
descriptionPrompt: |
  Analyze this image from a real estate document.
  If it is a floor plan: list all rooms with labels and measurements.
  If it is a chart: extract all data points, labels, and axis values.
  If it is a photo: describe the property features visible.
  Include all visible text, numbers, and dimensions.

# For financial documents
descriptionPrompt: |
  Analyze this image from a financial report.
  If it is a chart or graph: extract all data values, axis labels, legend entries, and trends.
  If it is a table rendered as image: transcribe all cell values.
  Be precise with all numbers and percentages.

# For technical manuals
descriptionPrompt: |
  Analyze this technical diagram or figure.
  List all labeled components and their connections.
  Describe flow directions, measurements, and specifications.
  Include part numbers and annotations if visible.
```

---

### Accelerator

```yaml
docling:
  accelerator:
    device: auto        # auto | cpu | cuda | mps
    numThreads: 4
    cudaUseFlashAttention2: false
```

- `device: auto` — auto-detects the best available hardware (recommended)
- `device: cuda` — force NVIDIA GPU
- `device: mps` — Apple Silicon GPU (M1/M2/M3)
- `device: cpu` — force CPU (slow, use only if no GPU available)
- `numThreads` — CPU threads for parallel processing (1–32). Match to your server's core count.
- `cudaUseFlashAttention2: true` — enables Flash Attention 2 optimization on NVIDIA GPUs (A100, H100, RTX 3090+). Leave `false` for older GPUs.

---

### Limits

```yaml
docling:
  limits:
    documentTimeout: 300     # seconds per document
    maxPages: 100            # optional: skip pages beyond this
    maxFileSize: 104857600   # optional: bytes (100MB)
```

- `documentTimeout` — maximum seconds to spend on one document (60–3600). **For large PDFs (100+ pages), increase to 600–900.**
- `maxPages` — omit to process all pages; set a limit to cap processing costs
- `maxFileSize` — omit for no limit; useful to reject unexpectedly large uploads

---

## Chunking — Text Segmentation

Chunking splits extracted text into pieces suitable for embedding and GraphRAG.

### Strategy

```yaml
chunking:
  strategy: docling_hybrid   # docling_hybrid | sentence | paragraph | fixed
```

| Strategy | How It Works | Best For |
|----------|-------------|----------|
| `docling_hybrid` | Respects document structure (headings, sections, tables). Splits at natural boundaries. | **Default. Best for structured documents: contracts, reports, manuals** |
| `sentence` | Splits on sentence boundaries | Narrative text, articles, news |
| `paragraph` | Splits on paragraph breaks | General documents without clear section structure |
| `fixed` | Fixed token windows | When structure is irrelevant; simple text corpora |

**Use `docling_hybrid` in almost all cases.** It understands the document's original structure and produces semantically coherent chunks that improve retrieval quality significantly.

---

### Token Sizes

```yaml
chunking:
  maxTokens: 1200        # tokens per chunk (100–8000)
  overlapTokens: 200     # token overlap between chunks (0–1000)
  tokenizer: cl100k_base
  mergePeers: true
  contextualize: true
```

**maxTokens recommendations:**

| Use Case | Recommended maxTokens | Reasoning |
|----------|----------------------|-----------|
| GraphRAG (default) | **1200** | Optimal balance for entity extraction. Smaller = more precise entities but less context |
| Dense financial/legal | 800–1000 | Shorter chunks improve extraction of specific values |
| Long narrative text | 1500–2000 | Preserves more context per chunk |
| Very short documents | 400–600 | Avoid splitting small sections |
| Simple Q&A retrieval | 512 | Fast, precise retrieval |

**overlapTokens recommendations:**

| Document Type | Recommended Overlap |
|--------------|--------------------|
| Contracts (clauses span sections) | 200–300 |
| Technical manuals | 100–200 |
| Plain text / articles | 50–100 |
| Self-contained sections (reports) | 0–100 |

The overlap ensures that context at the boundary between chunks isn't lost. **200 is a safe default.**

**Other options:**

- `tokenizer: cl100k_base` — use for GPT-4 / text-embedding-3 family (default, recommended)
- `mergePeers: true` — merges adjacent small chunks from the same section before splitting. Produces cleaner chunks. Keep `true`.
- `contextualize: true` — prepends the section heading path to each chunk (e.g., "Article 5 > Payment Terms > Section 5.2"). Dramatically improves retrieval. **Always keep `true`.**

---

### Metadata

```yaml
chunking:
  output:
    format: text_files         # text_files | json
    includeMetadataHeader: true

  metadata:
    includeHeadings: true
    includePageNumbers: true
    includePosition: true
    includeSource: true
```

- `format: text_files` — required for GraphRAG (one text file per chunk). Use `json` for API/custom consumption.
- `includeMetadataHeader: true` — adds a metadata block at the top of each chunk (source file, page, headings). Keeps `true` for GraphRAG — improves retrieval context.
- Keep all `metadata` flags `true`. They add provenance information used in citations and search results.

---

## GraphRAG — Knowledge Graph

GraphRAG builds a knowledge graph from your chunks using an LLM to extract entities, relationships, and community summaries. This enables both precise entity-level retrieval (local search) and broad thematic analysis (global search).

### Models

```yaml
graphrag:
  models:
    chatModel: gpt-4o-mini           # for entity extraction + summarization
    embeddingModel: text-embedding-3-large
    temperature: 0
    maxTokens: 4096
    embeddingBatchSize: 16
```

- `chatModel`: The LLM used for all extraction and summarization.
  - `gpt-4o-mini` — **recommended default**. Good accuracy, lower cost, sufficient for most domains.
  - `gpt-4o` — higher accuracy for complex extractions, ambiguous entities, or demanding domains. 5–10x more expensive.
  - `gpt-4-turbo` — alternative for large context requirements.
- `embeddingModel`: Used for vector embeddings.
  - `text-embedding-3-large` — **recommended**. 3072 dimensions, best quality.
  - `text-embedding-3-small` — cheaper, 1536 dimensions. Use for large corpora on tight budget.
- `temperature: 0` — always use 0 for extraction tasks. Higher temperature introduces inconsistency in structured outputs.
- `maxTokens: 4096` — response token limit. Increase to 8192 if entity lists are being truncated.
- `embeddingBatchSize` — how many texts to embed per API call. Increase to 32–64 on fast connections to speed up indexing.

---

### Entity Types

Entity types define what concepts the LLM should extract from your documents. **This is the most impactful configuration decision.**

```yaml
graphrag:
  entityExtraction:
    entityTypes:
      - PERSON
      - ORGANIZATION
      - LOCATION
      ...
```

**Rules for defining entity types:**

1. **Use domain-specific types** — generic types (PERSON, ORGANIZATION) produce weaker graphs than domain-specific ones (LANDLORD, TENANT, PREMISES)
2. **Keep types UPPER_CASE** — this is the expected format
3. **Use 8–25 types** — too few misses distinctions; too many confuses the LLM
4. **Name types for what they represent, not what they contain** — `MINIMUM_RENT` is better than `FINANCIAL_VALUE`
5. **Include relational types** (who the parties are) alongside content types (what the obligations are)

**Examples by domain:**

```yaml
# Commercial Leases
entityTypes:
  - LANDLORD
  - TENANT
  - GUARANTOR
  - PREMISES
  - BUILDING
  - MINIMUM_RENT
  - ADDITIONAL_RENT
  - SECURITY_DEPOSIT
  - TERM
  - COMMENCEMENT_DATE
  - EXPIRY_DATE
  - EXTENSION_OPTION
  - TERMINATION_RIGHT
  - INSURANCE_REQUIREMENT
  - MAINTENANCE_OBLIGATION
  - USE_RESTRICTION
  - DEFAULT

# Financial Reports / Investment Documents
entityTypes:
  - COMPANY
  - FUND
  - INVESTOR
  - ASSET
  - REVENUE
  - EXPENSE
  - PROFIT
  - VALUATION
  - RISK_FACTOR
  - FINANCIAL_PERIOD
  - PROJECTION
  - REGULATORY_REQUIREMENT

# Medical / Clinical Documents
entityTypes:
  - PATIENT
  - DIAGNOSIS
  - MEDICATION
  - DOSAGE
  - TREATMENT
  - PROCEDURE
  - PHYSICIAN
  - INSTITUTION
  - OUTCOME
  - ADVERSE_EVENT
  - TRIAL_PHASE
  - CONTRAINDICATION

# Software / Technical Documentation
entityTypes:
  - SERVICE
  - API_ENDPOINT
  - PARAMETER
  - RETURN_VALUE
  - ERROR_CODE
  - DEPENDENCY
  - VERSION
  - CONFIGURATION
  - WORKFLOW
  - PERMISSION
  - DATA_MODEL
```

---

### Writing the Entity Extraction Prompt

The entity extraction prompt is the most important customisation. A well-written prompt dramatically improves the quality and consistency of extracted entities and relationships.

**Structure of an effective prompt:**

```
-Goal-
Brief description of the extraction task and document domain.

-Entity Types-
List allowed types. State clearly that NO other types are allowed.

Type Definitions:
- TYPE_NAME: what it means, what to include/exclude

-Steps-
1. Entity extraction format
2. Relationship extraction format
3. Delimiter instructions

IMPORTANT: Rules to prevent common mistakes.

-Examples-
######################
[3+ examples showing input text → expected output]

-Real Data-
######################
entity_types: [...]
text: {input_text}
######################
output:
```

**Required placeholders** (GraphRAG injects these automatically):

| Placeholder | Description |
|-------------|-------------|
| `{input_text}` | The actual chunk text to process |
| `{tuple_delimiter}` | Separator between fields within a record |
| `{record_delimiter}` | Separator between records |
| `{completion_delimiter}` | End-of-output marker |

**Entity output format:**
```
("entity"{tuple_delimiter}<NAME>{tuple_delimiter}<TYPE>{tuple_delimiter}<DESCRIPTION>)
```

**Relationship output format:**
```
("relationship"{tuple_delimiter}<SOURCE>{tuple_delimiter}<TARGET>{tuple_delimiter}<DESCRIPTION>{tuple_delimiter}<STRENGTH>)
```

- Relationship strength: integer 1–10 (10 = core to the document's purpose)

---

**Full example prompt — Commercial Leases:**

```yaml
graphrag:
  entityExtraction:
    entityTypes:
      - LANDLORD
      - TENANT
      - GUARANTOR
      - PREMISES
      - BUILDING
      - MINIMUM_RENT
      - ADDITIONAL_RENT
      - SECURITY_DEPOSIT
      - TERM
      - COMMENCEMENT_DATE
      - EXPIRY_DATE
      - EXTENSION_OPTION
      - TERMINATION_RIGHT
      - NOTICE_PERIOD
      - INSURANCE_REQUIREMENT
      - MAINTENANCE_OBLIGATION
      - USE_RESTRICTION
      - DEFAULT

    maxGleanings: 1

    prompt: |
      -Goal-
      Extract entities and relationships from commercial lease documents. Always include specific values (dollar amounts, dates, percentages, square footage) directly in entity names.

      -Entity Types-
      You MUST use ONLY these entity types:
      [LANDLORD, TENANT, GUARANTOR, PREMISES, BUILDING, MINIMUM_RENT, ADDITIONAL_RENT, SECURITY_DEPOSIT, TERM, COMMENCEMENT_DATE, EXPIRY_DATE, EXTENSION_OPTION, TERMINATION_RIGHT, NOTICE_PERIOD, INSURANCE_REQUIREMENT, MAINTENANCE_OBLIGATION, USE_RESTRICTION, DEFAULT]

      Type Definitions:
      - LANDLORD: The property owner or lessor granting the lease
      - TENANT: The lessee or occupant paying rent
      - GUARANTOR: Party (often parent company) guaranteeing the tenant's obligations
      - PREMISES: The specific leased space (include address, unit, square footage)
      - BUILDING: The building containing the premises
      - MINIMUM_RENT: Base rent — include $/sqft AND total annual/monthly amounts
      - ADDITIONAL_RENT: Operating costs, taxes, utilities passed to tenant beyond base rent
      - SECURITY_DEPOSIT: Upfront deposit securing tenant obligations (include exact amount)
      - TERM: Total lease duration (e.g., "5 YEAR TERM")
      - COMMENCEMENT_DATE: When lease term officially starts
      - EXPIRY_DATE: When lease ends
      - EXTENSION_OPTION: Right to extend — include number of options and duration
      - TERMINATION_RIGHT: Right to end lease early — include conditions
      - NOTICE_PERIOD: Required advance notice for any action
      - INSURANCE_REQUIREMENT: Required coverage types and minimum amounts
      - MAINTENANCE_OBLIGATION: Who is responsible for repairs and what
      - USE_RESTRICTION: Permitted or prohibited uses of the premises
      - DEFAULT: Events constituting a breach of the lease

      -Steps-
      1. Identify all entities. For each:
         - entity_name: Descriptive WITH specific values (e.g., "MINIMUM RENT $135.00/SQFT $291,060/YEAR - YEARS 1-2")
         - entity_type: MUST be one of the types listed above
         - entity_description: Complete details including all dollar amounts, dates, percentages, conditions
         Format: ("entity"{tuple_delimiter}<entity_name>{tuple_delimiter}<entity_type>{tuple_delimiter}<entity_description>)

      2. Identify all relationships. For each:
         - source_entity: Entity name from step 1
         - target_entity: Entity name from step 1
         - relationship_description: How they relate or interact
         - relationship_strength: 1-10 (10 = core lease term like rent or parties; 1 = minor reference)
         Format: ("relationship"{tuple_delimiter}<source_entity>{tuple_delimiter}<target_entity>{tuple_delimiter}<relationship_description>{tuple_delimiter}<relationship_strength>)

      3. Use {record_delimiter} between records. End with {completion_delimiter}.

      IMPORTANT: Never leave entity_type blank. If an entity doesn't perfectly match a type, use the closest one. Never invent new types.

      -Examples-
      ######################

      Example 1:

      entity_types: [LANDLORD, TENANT, GUARANTOR, PREMISES, BUILDING, MINIMUM_RENT, ADDITIONAL_RENT, SECURITY_DEPOSIT, TERM, COMMENCEMENT_DATE, EXPIRY_DATE, EXTENSION_OPTION, TERMINATION_RIGHT, NOTICE_PERIOD, INSURANCE_REQUIREMENT, MAINTENANCE_OBLIGATION, USE_RESTRICTION, DEFAULT]
      text:
      The Tenant, EPIC LUXURY SYSTEMS INC. o/a BANG & OLUFSEN, agrees to lease the Premises from the Landlord, YORKVILLE OFFICE RETAIL CORPORATION. The Rentable Area is approximately 2,156 square feet at 135 Yorkville Avenue, Units 2 and 3. The Term is five (5) years commencing January 15, 2026.
      ------------------------
      output:
      ("entity"{tuple_delimiter}EPIC LUXURY SYSTEMS INC. o/a BANG & OLUFSEN{tuple_delimiter}TENANT{tuple_delimiter}Tenant corporation operating as Bang & Olufsen, high-end consumer electronics retailer, lessee under the lease)
      {record_delimiter}
      ("entity"{tuple_delimiter}YORKVILLE OFFICE RETAIL CORPORATION{tuple_delimiter}LANDLORD{tuple_delimiter}Landlord and property owner, lessor of 135 Yorkville Avenue)
      {record_delimiter}
      ("entity"{tuple_delimiter}135 YORKVILLE UNITS 2-3 - 2,156 SQFT{tuple_delimiter}PREMISES{tuple_delimiter}Commercial retail premises at 135 Yorkville Avenue, Units 2 and 3, Level 1, approximately 2,156 square feet rentable area)
      {record_delimiter}
      ("entity"{tuple_delimiter}5 YEAR TERM{tuple_delimiter}TERM{tuple_delimiter}Initial lease term of five years)
      {record_delimiter}
      ("entity"{tuple_delimiter}JANUARY 15, 2026{tuple_delimiter}COMMENCEMENT_DATE{tuple_delimiter}Date when the lease term officially commences)
      {record_delimiter}
      ("relationship"{tuple_delimiter}EPIC LUXURY SYSTEMS INC. o/a BANG & OLUFSEN{tuple_delimiter}YORKVILLE OFFICE RETAIL CORPORATION{tuple_delimiter}Tenant leases premises from Landlord under this commercial lease{tuple_delimiter}10)
      {record_delimiter}
      ("relationship"{tuple_delimiter}EPIC LUXURY SYSTEMS INC. o/a BANG & OLUFSEN{tuple_delimiter}135 YORKVILLE UNITS 2-3 - 2,156 SQFT{tuple_delimiter}Tenant occupies and leases this premises for retail operations{tuple_delimiter}10)
      {record_delimiter}
      ("relationship"{tuple_delimiter}5 YEAR TERM{tuple_delimiter}JANUARY 15, 2026{tuple_delimiter}Lease term of five years begins on this commencement date{tuple_delimiter}9)
      {completion_delimiter}
      #############################

      Example 2:

      entity_types: [LANDLORD, TENANT, GUARANTOR, PREMISES, BUILDING, MINIMUM_RENT, ADDITIONAL_RENT, SECURITY_DEPOSIT, TERM, COMMENCEMENT_DATE, EXPIRY_DATE, EXTENSION_OPTION, TERMINATION_RIGHT, NOTICE_PERIOD, INSURANCE_REQUIREMENT, MAINTENANCE_OBLIGATION, USE_RESTRICTION, DEFAULT]
      text:
      Minimum Rent for Years 1 and 2 is $135.00 per square foot per annum ($291,060.00 annually, $24,255.00 monthly). Year 3 increases to $140.00 per square foot ($301,840.00 annually). Years 4 and 5 are $145.00 per square foot ($312,620.00 annually). All amounts are plus HST. The Security Deposit is $71,464.22 inclusive of HST.
      ------------------------
      output:
      ("entity"{tuple_delimiter}MINIMUM RENT $135/SQFT - $291,060/YEAR - YEARS 1-2{tuple_delimiter}MINIMUM_RENT{tuple_delimiter}Base rent for Years 1-2: $135.00 per square foot per annum, totaling $291,060.00 annually ($24,255.00 monthly) plus HST)
      {record_delimiter}
      ("entity"{tuple_delimiter}MINIMUM RENT $140/SQFT - $301,840/YEAR - YEAR 3{tuple_delimiter}MINIMUM_RENT{tuple_delimiter}Base rent for Year 3: $140.00 per square foot per annum, totaling $301,840.00 annually plus HST)
      {record_delimiter}
      ("entity"{tuple_delimiter}MINIMUM RENT $145/SQFT - $312,620/YEAR - YEARS 4-5{tuple_delimiter}MINIMUM_RENT{tuple_delimiter}Base rent for Years 4-5: $145.00 per square foot per annum, totaling $312,620.00 annually plus HST)
      {record_delimiter}
      ("entity"{tuple_delimiter}SECURITY DEPOSIT $71,464.22 INCLUDING HST{tuple_delimiter}SECURITY_DEPOSIT{tuple_delimiter}Security deposit of $71,464.22 inclusive of HST, held by Landlord to secure Tenant's obligations)
      {record_delimiter}
      ("relationship"{tuple_delimiter}TENANT{tuple_delimiter}MINIMUM RENT $135/SQFT - $291,060/YEAR - YEARS 1-2{tuple_delimiter}Tenant pays this base rent during Years 1 and 2 of the lease{tuple_delimiter}10)
      {record_delimiter}
      ("relationship"{tuple_delimiter}TENANT{tuple_delimiter}MINIMUM RENT $140/SQFT - $301,840/YEAR - YEAR 3{tuple_delimiter}Tenant pays this escalated base rent during Year 3{tuple_delimiter}10)
      {record_delimiter}
      ("relationship"{tuple_delimiter}TENANT{tuple_delimiter}MINIMUM RENT $145/SQFT - $312,620/YEAR - YEARS 4-5{tuple_delimiter}Tenant pays this escalated base rent during Years 4 and 5{tuple_delimiter}10)
      {record_delimiter}
      ("relationship"{tuple_delimiter}MINIMUM RENT $135/SQFT - $291,060/YEAR - YEARS 1-2{tuple_delimiter}MINIMUM RENT $140/SQFT - $301,840/YEAR - YEAR 3{tuple_delimiter}Rent escalates by $5/sqft from Years 1-2 to Year 3{tuple_delimiter}8)
      {record_delimiter}
      ("relationship"{tuple_delimiter}TENANT{tuple_delimiter}SECURITY DEPOSIT $71,464.22 INCLUDING HST{tuple_delimiter}Tenant provides deposit to secure lease obligations{tuple_delimiter}9)
      {completion_delimiter}
      #############################

      Example 3:

      entity_types: [LANDLORD, TENANT, GUARANTOR, PREMISES, BUILDING, MINIMUM_RENT, ADDITIONAL_RENT, SECURITY_DEPOSIT, TERM, COMMENCEMENT_DATE, EXPIRY_DATE, EXTENSION_OPTION, TERMINATION_RIGHT, NOTICE_PERIOD, INSURANCE_REQUIREMENT, MAINTENANCE_OBLIGATION, USE_RESTRICTION, DEFAULT]
      text:
      The Tenant shall maintain comprehensive general liability insurance of not less than $5,000,000 per occurrence. The Tenant has two (2) options to extend the Term, each for five (5) years, provided 180 days' prior written notice is given. The Premises may only be used for the retail sale of luxury consumer electronics and related accessories.
      ------------------------
      output:
      ("entity"{tuple_delimiter}LIABILITY INSURANCE - $5,000,000 PER OCCURRENCE{tuple_delimiter}INSURANCE_REQUIREMENT{tuple_delimiter}Tenant must maintain comprehensive general liability insurance with minimum coverage of $5,000,000 per occurrence)
      {record_delimiter}
      ("entity"{tuple_delimiter}TWO 5-YEAR EXTENSION OPTIONS{tuple_delimiter}EXTENSION_OPTION{tuple_delimiter}Tenant holds two options to extend the lease term, each for five years, exercisable upon proper notice)
      {record_delimiter}
      ("entity"{tuple_delimiter}180 DAYS PRIOR WRITTEN NOTICE - EXTENSION{tuple_delimiter}NOTICE_PERIOD{tuple_delimiter}Required advance notice of 180 days to exercise extension option)
      {record_delimiter}
      ("entity"{tuple_delimiter}LUXURY CONSUMER ELECTRONICS RETAIL ONLY{tuple_delimiter}USE_RESTRICTION{tuple_delimiter}Permitted use of the Premises restricted to retail sale of luxury consumer electronics and related accessories only)
      {record_delimiter}
      ("relationship"{tuple_delimiter}TENANT{tuple_delimiter}LIABILITY INSURANCE - $5,000,000 PER OCCURRENCE{tuple_delimiter}Tenant is required to maintain this insurance coverage throughout the lease term{tuple_delimiter}9)
      {record_delimiter}
      ("relationship"{tuple_delimiter}TENANT{tuple_delimiter}TWO 5-YEAR EXTENSION OPTIONS{tuple_delimiter}Tenant holds the right to exercise these extension options{tuple_delimiter}8)
      {record_delimiter}
      ("relationship"{tuple_delimiter}TWO 5-YEAR EXTENSION OPTIONS{tuple_delimiter}180 DAYS PRIOR WRITTEN NOTICE - EXTENSION{tuple_delimiter}Extension option must be exercised with 180 days prior written notice{tuple_delimiter}8)
      {record_delimiter}
      ("relationship"{tuple_delimiter}TENANT{tuple_delimiter}LUXURY CONSUMER ELECTRONICS RETAIL ONLY{tuple_delimiter}Tenant's use of premises is restricted to this permitted use{tuple_delimiter}7)
      {completion_delimiter}
      #############################

      -Real Data-
      ######################
      entity_types: [LANDLORD, TENANT, GUARANTOR, PREMISES, BUILDING, MINIMUM_RENT, ADDITIONAL_RENT, SECURITY_DEPOSIT, TERM, COMMENCEMENT_DATE, EXPIRY_DATE, EXTENSION_OPTION, TERMINATION_RIGHT, NOTICE_PERIOD, INSURANCE_REQUIREMENT, MAINTENANCE_OBLIGATION, USE_RESTRICTION, DEFAULT]
      text: {input_text}
      ######################
      output:
```

---

### Relationships

Relationships are defined in the same extraction prompt as entities. Key principles:

**Strength scale (1–10):**

| Strength | Meaning |
|----------|---------|
| 10 | Core document relationship (party to party, party to primary obligation) |
| 8–9 | Important contractual link (obligation to deadline, right to condition) |
| 6–7 | Supporting relationship (secondary obligation, cross-reference) |
| 3–5 | Contextual link (location to building, general description) |
| 1–2 | Weak or incidental mention |

**Always extract relationships between:**
- Parties ↔ Parties (Tenant ↔ Landlord)
- Parties ↔ Obligations (Tenant → Insurance requirement)
- Obligations ↔ Conditions (Extension option → Notice period required)
- Financial terms ↔ Time periods (Rent $135 → Years 1-2)
- Escalation chains (Rent Year 1 → Rent Year 2 → Rent Year 3)

---

### Summarize Descriptions

When the same entity appears in multiple chunks, its descriptions are merged using the summarization prompt.

```yaml
graphrag:
  summarizeDescriptions:
    maxLength: 500        # characters per summarized description
    maxInputLength: 8000  # input character limit before truncation
    prompt: |
      You are consolidating descriptions for entities from [domain] documents.

      Given multiple descriptions of the same entity, produce one comprehensive description that:
      1. Preserves ALL specific values (amounts, dates, percentages, names)
      2. Combines unique details without duplication
      3. Never rounds, approximates, or generalizes numbers

      Entity: {entity_name}
      Descriptions: {description_list}

      Consolidated Description:
```

- `maxLength: 500` — good default. Increase to 800–1000 for entities that accumulate many details (e.g., a complex rent schedule).
- The prompt receives `{entity_name}` and `{description_list}` — always reference both.

---

### Claim Extraction

Claims are facts, obligations, or assertions extracted separately from entities.

```yaml
graphrag:
  claimExtraction:
    enabled: false        # disabled by default — adds API cost
    description: "Explicit obligations and factual claims in the document"
    maxGleanings: 1
    prompt: |
      Extract specific claims, obligations, and factual statements...
```

**Enable for:** Legal documents, compliance documents, regulatory filings where individual claims need to be tracked separately from entities.
**Leave disabled for:** General documents, when entity extraction already captures the needed information.

---

### Community Detection

GraphRAG groups related entities into communities and generates summaries for each.

```yaml
graphrag:
  communities:
    algorithm: leiden      # leiden | louvain
    resolution: 1.0
    minCommunitySize: 3
    maxLevels: 3
```

- `algorithm: leiden` — **recommended**. More accurate community detection than louvain.
- `resolution` (0.1–10): Controls granularity.
  - Lower (0.5) = fewer, larger communities (broader summaries)
  - Higher (2.0) = more, smaller communities (more specific summaries)
  - **1.0 is a good default for most document types**
- `minCommunitySize: 3` — minimum entities to form a community. Prevents trivial communities.
- `maxLevels: 3` — depth of hierarchical community structure. Increase to 4–5 for very large corpora.

---

### Community Reports Prompt

Community reports summarise each entity cluster. This is what global search uses to answer broad questions.

```yaml
graphrag:
  communityReports:
    maxLength: 2000
    maxInputLength: 8000
    prompt: |
      You are a [domain] expert. Analyze communities of entities to produce actionable summaries.

      # Goal
      Write a comprehensive report about a community of related entities from [domain] documents.

      # Report Structure
      - TITLE: Short descriptive name including key entities
      - SUMMARY: Executive summary with specific values and dates
      - RATING: Float 0-10 (10 = most critical/central to domain)
      - RATING EXPLANATION: One sentence
      - FINDINGS: 5-10 specific insights with data references

      Return as JSON:
      {{
          "title": <title>,
          "summary": <summary>,
          "rating": <rating>,
          "rating_explanation": <explanation>,
          "findings": [
              {{
                  "summary": <finding>,
                  "explanation": <explanation with data references>
              }}
          ]
      }}

      # Grounding Rules
      Reference data as: [Data: Entities (ids); Relationships (ids)]
      Use max 5 IDs per reference, add "+more" if needed.

      # Data
      {input_text}
      Output:
```

**Note:** Use `{{` and `}}` (double braces) around JSON template keys in YAML to escape them from GraphRAG's template engine.

- `maxLength: 2000` — report character limit. Increase to 3000–4000 for complex communities with many entities.
- `maxInputLength: 8000` — input limit before truncation. Increase for large communities.

---

### Embeddings

The `embeddings` section controls how entity and community texts are vectorised for similarity search. It does **not** have an `enabled` field — to disable embeddings, omit the section entirely.

```yaml
graphrag:
  embeddings:
    model: text-embedding-3-large   # embedding model (matches graphrag.models.embeddingModel)
    dimensions: 3072                # vector dimensions (3072 for text-embedding-3-large)
    batchSize: 100                  # texts per API batch
```

Fields:
- `model` — the embedding model name. Must match what `graphrag.models.embeddingModel` uses.
  - `text-embedding-3-large` → set `dimensions: 3072` (default)
  - `text-embedding-3-small` → set `dimensions: 1536`
- `dimensions` — must match the model's output dimensions.
- `batchSize` — number of text chunks sent per embedding request. Default `100`.

> **Do not write `enabled: true` or any other key here.** The schema only allows `model`, `dimensions`, and `batchSize`.

---

### Local Search

Local search answers specific, entity-focused questions ("What is the rent?", "Who are the parties?").

```yaml
graphrag:
  localSearch:
    topKEntities: 10          # top entities to retrieve
    topKRelationships: 10     # top relationships to retrieve
    topKCommunityReports: 5   # community reports to include
    maxContextTokens: 12000   # total context window
    prompt: |
      ---Role---
      You are a [domain] expert answering questions using extracted knowledge graph data.

      ---Domain Knowledge---
      [Define what each entity type means and how to interpret it]

      ---Goal---
      Answer the user's question using ONLY the data tables provided.
      - Be specific: include exact values, dates, and amounts from the data
      - Cite sources: [Data: Entities (ids); Relationships (ids)]
      - State clearly if information is not in the data

      ---Target response length and format---
      {response_type}

      ---Data tables---
      {context_data}

      Style the response in markdown.
```

- `topKEntities / topKRelationships` — increase to 20–30 for complex queries that touch many entities. Watch `maxContextTokens` to avoid overflow.
- `maxContextTokens: 12000` — total context budget. Use up to 16000 for GPT-4o, 32000 for GPT-4-turbo.

---

### Global Search

Global search answers broad questions ("Summarise all lease obligations", "What are the key financial terms across all documents?").

```yaml
graphrag:
  globalSearch:
    maxCommunities: 10
    mapMaxTokens: 4000
    reduceMaxTokens: 8000

    knowledgePrompt: |
      ---Role---
      You are a [domain] expert with deep knowledge of [document type].

      ---Domain Knowledge---
      [Terminology, concepts, and interpretation rules for your domain]

      ---Goal---
      Use this expertise to interpret the provided data accurately.

      ---Data---
      {context_data}

    mapPrompt: |
      ---Role---
      You are a [domain] expert analyzing a community report to answer a question.

      ---Goal---
      From this community report, extract:
      1. A relevance score (0-100) for the question
      2. Key points relevant to the answer

      ---Target response length and format---
      {response_type}

      ---Community Report---
      {context_data}

    reducePrompt: |
      ---Role---
      You are a [domain] expert synthesizing community analyses.

      ---Goal---
      Combine the community analyses into a comprehensive answer:
      1. Prioritize higher-scored communities
      2. Include all specific values (amounts, dates, percentages)
      3. Note contradictions or variations
      4. State clearly when information is unavailable

      ---Target response length and format---
      {response_type}

      ---Community Analyses---
      {report_data}
```

- `maxCommunities: 10` — how many community reports to scan per query. Increase to 20–30 for large corpora.
- `mapMaxTokens: 4000` / `reduceMaxTokens: 8000` — token budgets for each phase. Increase if responses are being cut off.

---

### DRIFT Search

DRIFT (Dynamic Reasoning and Inference for Finding Themes) is an experimental search mode that iteratively refines queries.

```yaml
graphrag:
  driftSearch:
    enabled: false    # experimental, disabled by default
    prompt: |
      ...
    reducePrompt: |
      ...
```

Enable only if you need theme discovery across large, varied document collections. For most use cases, local and global search are sufficient.

---

### Clustering & Cache

```yaml
graphrag:
  clusterGraph:
    maxClusterSize: 10   # max entities per cluster
    useLcc: true         # use largest connected component
    seed: 42             # reproducibility seed

  cache:
    enabled: true
    type: file           # file | memory | none
```

- `maxClusterSize: 10` — limits cluster size for community reports. Reduce to 5–7 for very large graphs with many communities.
- `useLcc: true` — focuses GraphRAG on the main connected subgraph, discarding outliers. Keep `true`.
- `seed: 42` — for reproducible community detection across runs.
- `cache: file` — caches LLM calls to disk. Dramatically speeds up re-runs and reduces API costs. Always keep enabled in production.

---

### maxGleanings

```yaml
graphrag:
  entityExtraction:
    maxGleanings: 1   # 0 | 1 | 2 | 3
```

Controls how many additional extraction passes the LLM performs on each chunk to find missed entities.

| Value | Cost | When to Use |
|-------|------|-------------|
| 0 | Minimal | High volume, cost-sensitive, documents with simple structure |
| 1 | Low | **Default. Good balance for most documents** |
| 2 | Medium | Complex documents where thoroughness matters (dense contracts) |
| 3+ | High | Maximum extraction; only for critical documents |

Each gleaning pass costs additional API tokens. For a 500-chunk document with `maxGleanings: 2`, expect roughly 3× the API cost vs `maxGleanings: 0`.

---

## API Keys

```yaml
apiKeys:
  openai: ${OPENAI_API_KEY}      # reads from environment variable
  # baseUrl: https://api.openai.com/v1   # optional: custom endpoint
```

Always use environment variable syntax (`${VAR_NAME}`) rather than hardcoding keys in config files.

**Custom endpoints** (`baseUrl`) allow you to point the pipeline at:
- Azure OpenAI: `https://your-resource.openai.azure.com/`
- Local LLMs (vLLM, Ollama with OpenAI compat): `http://localhost:8080/v1`
- OpenRouter: `https://openrouter.ai/api/v1`

The `baseUrl` applies to all model calls: GraphRAG chat, embeddings, and Docling picture descriptions.

---

## Recommendations by Document Type

### Commercial Leases / Contracts

```yaml
docling:
  layout:
    model: docling-layout-egret-large
  ocr:
    enabled: true
    engine: rapidocr
    backend: torch
    forceFullPageOcr: true
  tables:
    mode: accurate

chunking:
  strategy: docling_hybrid
  maxTokens: 1000
  overlapTokens: 250
  contextualize: true

graphrag:
  models:
    chatModel: gpt-4o-mini
  entityExtraction:
    maxGleanings: 1
    entityTypes: [domain-specific types as above]
```

**Rationale:** Contracts have complex formatting and precise values that must not be missed. High overlap (250) because clauses often reference terms defined pages earlier. `maxGleanings: 1` for balance between cost and completeness.

---

### Financial Reports / Investor Documents

```yaml
docling:
  layout:
    model: docling-layout-egret-xlarge   # complex tables, charts
  tables:
    mode: accurate
  pictures:
    enabled: true
    enableDescription: true
    descriptionModel: gpt-4o   # charts need high accuracy

chunking:
  strategy: docling_hybrid
  maxTokens: 800
  overlapTokens: 150

graphrag:
  models:
    chatModel: gpt-4o   # financial data needs accuracy
  entityExtraction:
    entityTypes:
      - COMPANY
      - FUND
      - REVENUE
      - EXPENSE
      - ASSET
      - VALUATION
      - FINANCIAL_PERIOD
      - RISK_FACTOR
    maxGleanings: 2
```

**Rationale:** Financial reports have complex tables and charts. `egret-xlarge` gives best table detection. `gpt-4o` for extraction reduces numeric errors. Smaller chunks (800) improve precision of financial figure extraction.

---

### Scanned Documents / Poor Quality PDFs

```yaml
docling:
  layout:
    model: docling-layout-egret-large
  ocr:
    enabled: true
    engine: rapidocr
    backend: torch
    textScore: 0.3        # lower threshold for poor quality
    forceFullPageOcr: true
  limits:
    documentTimeout: 600  # scanned docs take longer

chunking:
  strategy: docling_hybrid
  maxTokens: 1200
  overlapTokens: 300     # higher overlap for OCR errors at boundaries
```

**Rationale:** Lower `textScore` (0.3) accepts more text even when confidence is lower — better than missing content on degraded scans. Higher timeout for processing. More overlap compensates for OCR errors at chunk boundaries.

---

### Multi-Language Documents

```yaml
docling:
  ocr:
    enabled: true
    engine: easyocr
    languages: [en, fr, de]   # list all languages present
    backend: torch

chunking:
  tokenizer: cl100k_base   # works well across languages

graphrag:
  models:
    chatModel: gpt-4o   # better multilingual than gpt-4o-mini
```

**Rationale:** `easyocr` has the best multilingual OCR support. `gpt-4o` handles non-English entity extraction more reliably.

---

### Technical Manuals / Documentation

```yaml
docling:
  layout:
    model: docling-layout-egret-medium   # manuals have predictable structure
  pictures:
    enabled: true
    enableDescription: true
    descriptionModel: gpt-4o-mini
    descriptionPrompt: |
      Analyze this technical diagram or figure.
      List all labeled components and their connections.
      Describe flow directions, measurement values, and specifications.
      Include part numbers, error codes, and annotations.

chunking:
  strategy: docling_hybrid
  maxTokens: 1500     # technical sections can be longer
  overlapTokens: 100

graphrag:
  entityExtraction:
    entityTypes:
      - COMPONENT
      - API_ENDPOINT
      - PARAMETER
      - CONFIGURATION
      - ERROR_CODE
      - WORKFLOW
      - DEPENDENCY
      - VERSION
```

---

### High-Volume Batch Processing (Speed Priority)

```yaml
docling:
  layout:
    model: docling-layout-heron    # fastest
  ocr:
    engine: rapidocr
    backend: onnx                  # CPU-optimized
    forceFullPageOcr: false        # only OCR where needed
  pictures:
    enableDescription: false       # skip for speed

chunking:
  strategy: docling_hybrid
  maxTokens: 1500                  # fewer, larger chunks

graphrag:
  models:
    chatModel: gpt-4o-mini
  entityExtraction:
    maxGleanings: 0                # single pass only
```

---

## Complete Example Configs

### Minimal Config (defaults only)

```yaml
name: "My Pipeline"
apiKeys:
  openai: ${OPENAI_API_KEY}
```

---

### General Purpose Document Pipeline

```yaml
name: "General Document Pipeline"
description: "Balanced config for mixed document types"

docling:
  layout:
    model: docling-layout-egret-large
  ocr:
    enabled: true
    engine: rapidocr
    backend: torch
    languages: [en]
    textScore: 0.5
    forceFullPageOcr: true
  tables:
    enabled: true
    mode: accurate
  pictures:
    enabled: true
    enableDescription: true
    descriptionModel: gpt-4o-mini
  accelerator:
    device: auto
    numThreads: 4
  limits:
    documentTimeout: 300

chunking:
  strategy: docling_hybrid
  maxTokens: 1200
  overlapTokens: 200
  tokenizer: cl100k_base
  mergePeers: true
  contextualize: true
  output:
    format: text_files
    includeMetadataHeader: true
  metadata:
    includeHeadings: true
    includePageNumbers: true
    includePosition: true
    includeSource: true

graphrag:
  enabled: true
  models:
    chatModel: gpt-4o-mini
    embeddingModel: text-embedding-3-large
    temperature: 0
    maxTokens: 4096
  entityExtraction:
    entityTypes:
      - PERSON
      - ORGANIZATION
      - LOCATION
      - DATE
      - MONEY
      - DOCUMENT
      - OBLIGATION
      - CONDITION
    maxGleanings: 1
  summarizeDescriptions:
    maxLength: 500
  communities:
    algorithm: leiden
    resolution: 1.0
    minCommunitySize: 3
  communityReports:
    maxLength: 2000
  localSearch:
    topKEntities: 10
    topKRelationships: 10
    maxContextTokens: 12000
  globalSearch:
    maxCommunities: 10
  clusterGraph:
    maxClusterSize: 10
    useLcc: true
    seed: 42
  cache:
    enabled: true
    type: file

apiKeys:
  openai: ${OPENAI_API_KEY}
```

---

### Lean Config (CPU server, cost-sensitive)

```yaml
name: "Lean CPU Pipeline"

docling:
  layout:
    model: docling-layout-egret-medium
  ocr:
    enabled: true
    engine: rapidocr
    backend: onnx
    forceFullPageOcr: false
  pictures:
    enabled: false
  accelerator:
    device: cpu
    numThreads: 8

chunking:
  strategy: docling_hybrid
  maxTokens: 1500
  overlapTokens: 100

graphrag:
  enabled: true
  models:
    chatModel: gpt-4o-mini
    embeddingModel: text-embedding-3-small
  entityExtraction:
    maxGleanings: 0
  cache:
    enabled: true
    type: file

apiKeys:
  openai: ${OPENAI_API_KEY}
```

---

*For schema reference, see: `packages/nest-doc-processing-api/src/schemas/config.schema.yaml`*
*For a full annotated template, see: `packages/nest-doc-processing-worker/templates/config.default.yaml`*
