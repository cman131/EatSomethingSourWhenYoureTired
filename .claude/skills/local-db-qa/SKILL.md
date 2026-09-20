---
name: local-db-qa
description: AI-assisted local quality testing using MongoDB (Mongoose ODM) queries to arrange test data, verify preconditions, and assert outcomes after running code locally.
---

# Local Database QA Testing

<!-- EXAMPLE (dha-rules-svc): Cosmos SQL API against the dha-rules container in the es-sandbox01 subscription -->

AI-assisted local quality testing using MongoDB (Mongoose ODM) queries to arrange test data, verify preconditions, and assert outcomes after running code locally.

## Input

The user provides via `$ARGUMENTS`:
- A PR URL, branch name, or "local changes" to derive test context
- Optionally, a specific scenario to test (e.g., "test suppression recovery for a delivery-failed record")

If no argument is provided, default to analyzing uncommitted local changes via `git diff`.

## MongoDB (Mongoose ODM) Connection — First-Time Setup

Each developer typically has their own account/instance in the shared dev sandbox. On first use:

1. Check memory for a saved account name or connection identifier (look for a memory with the data store's name and "account" in the description)
2. If not found, ask the user for their sandbox account/connection identifier. Save the answer to memory as a `reference` type with a description like "Developer's MongoDB (Mongoose ODM) account name for local testing"

Fixed parameters (shared across all developers — e.g. subscription/project id, resource group or cluster name, database or schema name) should be documented once in this project's `CLAUDE.md` or `.claude/rules/context.md` and never re-derived per developer. Only the per-developer account/instance identifier varies.

**Container/table depends on entity type — never assume the wrong one.** A single logical database commonly spans several containers, tables, or collections, and each entity type lives in exactly one. Looking in the wrong one returns empty results that silently masquerade as "no data found." Keep an up-to-date Entity Type → Container/Table map (see below) and consult it before any query or upsert.

### Auth Method

Some query/MCP tools default to an auth method (e.g. RBAC/managed identity) that does not work with developer sandbox credentials. **Confirm which auth method your tool requires and pass it explicitly on every query.** This applies to all read queries as well as verification queries after document writes.

## Creating / Updating Documents

Many MongoDB (Mongoose ODM) query/MCP tools only support **read queries**. To create or upsert records, use your MongoDB (Mongoose ODM)'s own SDK or CLI via a Bash command. This should be fully automated — do NOT ask the user to manually insert documents.

**Prerequisite**: the relevant MongoDB (Mongoose ODM) client library/SDK must be installed locally. If a write fails with an import/module error, install it first.

### Write pattern (upsert):

1. **Identify the target container/table** for the entity type (see the map below).
2. Write the JSON (or equivalent) document to `/tmp/db-test-doc.json` using the Write tool.
3. Run a Bash command that:
   - Fetches the sandbox connection credential via your MongoDB (Mongoose ODM)'s CLI (never hardcode a secret in the script)
   - Connects using your MongoDB (Mongoose ODM)'s SDK
   - Loads `/tmp/db-test-doc.json`
   - Upserts it into the target container/table identified in step 1
   - Prints the id of the record that was written

4. Verify the document was created by querying it back **against the same container/table** with your read-only query tool.

**Important**: Always show the user what document will be created/modified before executing the write. Never silently write to the database.

### Operations NOT allowed by this skill:

- **Deletes**: Never delete records via this skill. If cleanup is needed, tell the user to delete manually via the data store's own console/portal.

## Entity Type → Container/Table Map

<!-- EXAMPLE: replace with your own precedent -->
Document your project's containers/tables and which entity type lives in each, e.g.:

| Container/Table | Partition/Primary Key | Entity stored |
|---|---|---|
| `{ContainerA}` | `{PartitionKeyField}` | `{EntityTypeA}` — one-line description of what it holds and how it's written (append-only vs. upsert-in-place) |
| `{ContainerB}` | `{PartitionKeyField}` | `{EntityTypeB}` — one-line description |

Field names in the store may or may not match your code's property names directly — note any casing/renaming mismatches here if they exist.

### Diagnostic guardrail — verify the service is reading the same container/table

When investigating empty query results, before suspecting deserialization bugs or partition-key problems, **confirm the service is reading the same container/table as your query**:
- Tail the service log for container/table initialization lines on startup — these typically print every container/table the service opens.
- Cross-check that the entity type you're arranging matches the correct container/table.

A wrong-container arrange step looks identical to a real bug from the outside — both produce empty result sets — but the fix is completely different.

## Entity Schema Reference

<!-- EXAMPLE: replace with your own precedent -->
For each entity type used in test arrangement, document its key fields here so test documents can be constructed correctly, e.g.:

### Key `{EntityTypeA}` Fields
- `id`: the store's system/primary identifier
- `{PartitionKeyField}`: e.g. an environment or tenant id
- other required fields and their expected shapes/formats

**Important**:
- **Strongly-typed id fields** (GUIDs, UUIDs, etc.): before creating test documents, check the code's model class for any properties typed as a strict id type. These fields must contain validly-formatted values, never arbitrary strings — an invalid value can cause a deserialization exception at read time.
- Note whether field names in the store match your code's property names directly, or whether renames/casing conventions are in play.
- Note the store's system id property name (e.g. `id`, `_id`, `pk`) and always set it to a valid value of the expected type.

## Process

### Step 1: Derive Test Context

Analyze the code changes to understand what behavior needs testing:

1. If a PR URL is provided, fetch the PR description and changed files
2. If "local changes" or no argument, run `git diff --stat` and `git diff` to see what changed
3. Read the changed files to understand:
   - What new code paths were added
   - What conditions/guards exist (these become test scenarios)
   - What data state is needed to trigger each path
4. Present a numbered list of **test scenarios** derived from the code, e.g.:
   - Scenario 1: Happy path — valid input message → expected records persisted
   - Scenario 2: Filter rejection — message that should be rejected → no documents created
   - Scenario 3: Invalid input → record written with a failed/error status, error logged

Ask the user which scenario(s) to test, or let them describe a custom one.

### Step 2: Arrange — Query and Prepare Data

For the chosen scenario:

1. **Identify the target container/table.** Look up the entity type you'll be reading/writing in the [Entity Type → Container/Table map](#entity-type--containertable-map). Every subsequent query and upsert in this step must target that container/table.

2. **Query existing data** in that container/table to find documents that match or are close to the desired state, using MongoDB shell / mongosh queries. Example shape:
   ```
   -- find recent records for a given scope
   SELECT <key fields>
   FROM <container/table>
   WHERE <scope field> = '{scopeValue}'
   ORDER BY <timestamp field> DESC
   LIMIT 5
   ```

3. **Show the user what was found** — display key fields of candidate documents

4. **If no matching document exists**:
   - Generate the full document with all required fields matching the codebase's document schema
   - Write it to `/tmp/db-test-doc.json`
   - Use the automated upsert pattern targeting the container/table from step 1 — to create the document
   - Verify the document was created by querying it back from the same container/table

5. **If an existing document needs modification** to match the test scenario:
   - Show the current state
   - Generate a modified version of the document
   - Write it to `/tmp/db-test-doc.json`
   - Use the automated upsert pattern to update the document

6. **Verify preconditions** — query the specific document and confirm it's in the expected state before the test runs. Show the user a summary:
   ```text
   Arrange complete:
   - Container/table: {name}
   - Document id: {id}
   - Scope field: {value}
   - Key fields: (whatever fields matter for this scenario)
   ```

### Step 3: Act — User Runs the Code

Tell the user what to do:
- If testing an HTTP endpoint: provide the curl/Swagger request to hit the local endpoint
- If testing a message-bus listener: point them to the test-message-bus-listener skill
- If testing automatic behavior: tell them what trigger to invoke

Wait for the user to confirm they've run the code.

### Step 4: Assert — Verify Outcomes

After the user runs the code:

1. **Re-query the document** to see what changed, using MongoDB shell / mongosh queries:
   ```
   SELECT * FROM <container/table> WHERE id = '{documentId}'
   ```

2. **Compare before/after state** — highlight what changed:
   - New document created (or existing one updated)
   - Related documents appended/created
   - Lifecycle/status fields transitioned correctly
   - Timestamp fields updated

3. **Report the result**:
   ```text
   PASS: record created with Status=Success
   PASS: N related documents written
   FAIL: No record found — check service logs for the ingest error
   ```

4. **Suggest next steps** if something unexpected happened — check logs, verify service is running, etc.

## Rules

- Always use the project's fixed connection parameters (subscription/project, resource group/cluster, database/schema) — never omit or improvise them
- **Always identify the target container/table by entity type before any query or upsert** — use the [Entity Type → Container/Table map](#entity-type--containertable-map); never assume
- Always include the scope/partition field in queries that filter by tenant/environment
- Never modify production data — this technique only works against the developer's personal sandbox account/instance
- When showing document contents, omit large fields like raw blob payloads — show a truncated preview of key fields
- For opaque/free-form JSON fields, show a short preview rather than the full payload
- When creating or patching documents, always show the user the before state and proposed changes before writing
- If the user says "check again" or "assert", re-query and compare to the last known state
- On first use, ask for and save the developer's sandbox account/connection identifier to memory
- If a query returns empty when you expected results, **verify the service is reading the same container/table as your query before suspecting code bugs** — a wrong-container arrange step is indistinguishable from a real bug at the wire level
