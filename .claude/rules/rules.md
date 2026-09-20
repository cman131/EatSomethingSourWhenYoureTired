# rules.md - Coding Standards & Conventions

## Language & Framework Settings

- **Frontend target**: TypeScript 4.9+, React 18 — pin exact major versions in `package.json`
- **Backend target**: Node.js (CommonJS modules, `require`/`module.exports`), Express 4
- **Strict mode**: Enabled (`"strict": true` in `client/tsconfig.json`) — all frontend code must be null-safe
- **Linting**: ESLint via `react-app` preset on the frontend; standard ESLint on the backend

## Naming Conventions

The table below is a language-agnostic default. Stack-specific conventions take precedence where the target language has its own idiomatic default.

| Element | Convention | Example |
|---------|-----------|---------|
| Classes, structs, enums | PascalCase | `ScanResult` |
| Interfaces | `I` prefix + PascalCase | `IScanResultRepository` |
| Methods, properties | PascalCase | `GetScanResultAsync` |
| Local variables, parameters | camelCase | `customerId` |
| Constants | PascalCase | `MaxRuleCount` |
| Private fields | camelCase (no prefix) | `ruleRepository` |
| Async methods | `Async` suffix | `AddScanResultAsync` |

## Clean Code Principles

### Separation of Concerns
Every class should have **one reason to change**. Keep these layers distinct:
- **Controllers** — HTTP request/response handling only. No business logic. Delegate immediately to a service.
- **Services** — Business logic and orchestration. No data access details, no HTTP concerns.
- **Data Access** — Storage reads/writes only. No business rules.
- **Models** — Data shape only. No behavior beyond simple computed properties.
- **Contracts** — DTOs for API input/output (see below). No business logic, no persistence concerns.

### DTOs & Contracts
**All API endpoints must use dedicated request/response DTOs** — never expose domain models or persistence entities directly through controllers. This is a known gap in the codebase that must be corrected going forward.

- Place DTOs in a `Contracts/` folder, organized by feature (e.g., `Contracts/Rules/`, `Contracts/ScanResults/`)
- **Request DTOs**: Named `{Action}{Resource}Request` (e.g., `CreateRuleRequest`, `GetScanResultRequest`)
- **Response DTOs**: Named `{Resource}Response` or `{Action}{Resource}Response` (e.g., `RuleResponse`, `ScanResultResponse`)
- **File names**: Each DTO should have its own file named after the DTO class with `Request` or `Response` suffix (e.g., `CreateRuleRequest.cs`, `ScanResultResponse.cs`)
- Use `record` types for DTOs — they are immutable and provide value equality
- Controllers accept request DTOs and return response DTOs
- Map between DTOs and domain models in the **service layer**, not in controllers or data access
- DTOs must not contain navigation properties, ETag fields, partition keys, or other storage concerns
- DTOs must not reference internal domain types — they define the public API surface
- **Input validation**: Validate user-provided collections in controllers (filter null/empty strings, limit sizes). Trust validated data internally.

### No God Classes
- A class should do **one thing well**. If a class name needs "And" or "Manager" to describe it, it's doing too much.
- Watch for warning signs: too many constructor dependencies (more than ~5-7), methods that don't use the same fields, files over ~300 lines
- Split large services by responsibility. Prefer composing smaller focused services over one large class that handles everything.
- If a service is growing large, extract focused collaborators rather than putting all logic inside one class

### Method Design
- Methods should do one thing at one level of abstraction
- Prefer **small, focused methods** with clear names over long methods with comments explaining sections
- Avoid boolean flag parameters that change method behavior — split into two methods instead
- Keep method parameter count low (ideally 3 or fewer). If you need more, introduce a request/options object.

### Avoid Primitive Obsession
- Use strong types over raw strings/ints for domain concepts (e.g., a dedicated `TenantId` type over `string`, an `InteractionType` enum over `string`)
- Validate at the boundary (controller/webhook entry point), then trust the types internally

### Domain identity strings come from a single source of truth
If your domain has identity strings, codes, or names that appear in multiple places (API contracts, tests, UI copy), define one canonical accessor/lookup and resolve from it everywhere — never hard-code the literal in more than one place.

## Code Style Rules

- **Braces**: Same-line (K&R-style) — opening brace on the same line as the declaration
- **`this.` qualifier**: Not applicable in functional React — use plain variable names in hooks and components
- **Indentation**: 2 spaces
- **Formatting**: Prettier-enforced — run `prettier --check` before considering work done

- **Braces required**: Always use braces, even for single-line `if`/`else`
- **Line endings**: LF (CRLF or LF — pick one and enforce via .editorconfig)
- **Final newline**: Required
- **Trailing whitespace**: Trimmed

A stack profile may override any of the above where the language's own tooling has a strong idiomatic default.

## Async Patterns

- Prefer `async`/`await` for all async logic — no raw `.then()` chains
- In React components, handle loading and error states explicitly — never leave the user staring at an empty component while data is fetching
- On the backend, always pass errors to `next(err)` in Express route handlers — do not let unhandled promise rejections crash the server

## Idempotency

All operations that run within orchestrations or are triggered by Service Bus messages **must be idempotent**. Orchestrations replay from the beginning on failure/restart, and Service Bus messages can be delivered more than once.

- **Activity functions**: Must produce the same result if called multiple times with the same input. Use upsert instead of insert; check for existing state before creating resources.
- **Orchestrations**: Never use non-deterministic operations directly in orchestrator code (no `DateTime.Now`, `Guid.NewGuid()`, direct HTTP calls, or `Task.Delay`) — if using a durable-orchestration framework, use its replay-safe primitives instead of direct system calls (DateTime.Now, Guid.NewGuid(), raw HTTP, or Task.Delay equivalents).
- **Service Bus handlers**: Must tolerate duplicate message delivery. Use idempotency keys or check-before-act patterns.
- **External API calls**: Wrap in activity functions with retry policies. Assume any call may be retried.
- **Database writes**: Prefer upsert over insert. Include concurrency checks (e.g. ETags) where needed.

## Dependency Injection

- All services must be defined with an interface (e.g., `IFoo` / `Foo`)
- Register services using `Add*()` extension methods on `IServiceCollection`
- Use constructor injection (primary constructors preferred)
- Lifetime guidance: Scoped for request-bound services, Singleton for stateless utilities, Transient sparingly

## Project Organization

- **One class per file** (standard convention)
- **Namespace/module must match folder structure**
- Group by feature domain: `Games/, Tournaments/, Users/, Auth/, Resources/` — list this project's actual feature-domain folders here (e.g., the top-level business areas your controllers/services are organized around)
- Separate concerns: `Models/`, `DataAccess/`, `Services/`, `Controllers/`, `Contracts/`
- **`Contracts/`** — API request/response DTOs, organized by feature subdirectory. New endpoints must use dedicated DTOs here.

## Testing Standards

- **Framework**: Jest (via `react-scripts test`)
- **Component testing**: React Testing Library — query by accessible role/label, not CSS class or DOM structure
- Run tests with `--watchAll=false` so the process exits; never omit this flag
- Prefer `screen.getByRole` and `screen.getByLabelText` over `querySelector` in component tests

Keep test naming conventions: `{MethodName}_{Scenario}_{ExpectedResult}` or descriptive sentence style.

- Test class naming: `{ClassUnderTest}Tests`
- Test method naming: `{MethodName}_{Scenario}_{ExpectedResult}` or descriptive sentence style
- Each `src/` project has a corresponding `test/` project
- Tests access internals via your language's visibility mechanism (e.g., C#'s `InternalsVisibleTo` attribute)

## API Conventions

- Use attribute-based routing: `[Route("v1/...")]`
- Controllers inherit from `ControllerBase`
- Use filter attributes for authorization and request context
- Return appropriate HTTP status codes
- Document public APIs with XML comments (feeds into Swagger)
- **Public-facing API docs must contain no internal-only identifiers** (ADR names/numbers, internal ticket ids, internal-only class names) — keep those in code comments and internal docs only.

## Error Handling

- Use structured logging
- Handle specific exceptions — avoid catch-all handlers
- Return proper HTTP status codes from controllers (404 for not found, etc.)
- Log warnings for expected failures (e.g., 404 from downstream services)

### Log sanitization is scoped by provenance, not applied everywhere
Before logging a string, know who controls it. Externally-supplied values (any party outside your trust boundary, including tenant-facing request fields containing free text) must be sanitized against log-injection (CWE-117) at the boundary where they enter the process — not scattered at each log call. Internally-sourced values (from your own trusted ingestion pipeline or a closed set of your own constants) can be logged directly.

## Data Access

Document this project's specific data-access invariants (write models, concurrency strategy, trusted-caller patterns if applicable) in `.claude/rules/context.md`, not here.

- Prefer `record` (or your language's equivalent immutable value type) for DTOs and data transfer objects

## What NOT to Do

- Do not add `ConfigureAwait(false)` calls
- Do not suppress warnings without documented justification
- Do not put business logic in controllers — delegate to services
- Do not add packages without verifying compatibility with the existing dependency stack
- Do not create new projects without discussing architecture first
- Do not expose domain models or persistence entities directly from API endpoints — use Contracts DTOs
- Do not put mapping logic in controllers — map between DTOs and domain models in the service layer
- Do not create god classes — if a service has more than ~5-7 dependencies or exceeds ~300 lines, split it
- Do not put internal identifiers in any text that feeds public API docs — see "Public-facing API docs must contain no internal-only identifiers" under API Conventions above
- Do not log an externally supplied string — including any route/query/body value on a tenant-facing endpoint — without sanitizing it at its entry boundary, and do not blanket-wrap internally sourced values in a sanitizer helper — see "Log sanitization is scoped by provenance" under Error Handling above
