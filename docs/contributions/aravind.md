# Aravind – Contribution Document

## Role

**Team Lead – Express Application Setup, Server Startup, Common Middleware, Members APIs, and Dependency/Package Management**

Branch: `feature/aravind-server`

---

## Files Owned

| File | Purpose |
|------|---------|
| `package.json` | Project manifest, dependencies (`express`, `better-sqlite3`, `nodemon`), and npm scripts |
| `package-lock.json` | Deterministic dependency lockfile |
| `.gitignore` | Ignores `node_modules/`, `.env`, `data/*.db`, logs, OS/editor noise |
| `src/app.js` | Express app initialization, JSON body parsing, route mounting, 404 and error middleware (exported without listening) |
| `src/server.js` | Server entrypoint: initializes SQLite database via `src/db/init.js` and starts HTTP server on `process.env.PORT \|\| 3000` |
| `src/routes/members.routes.js` | Express router for `/api/members` endpoints |
| `src/controllers/members.controller.js` | Controller for `GET /api/members`, `GET /api/members/:id`, `POST /api/members` |
| `src/middleware/notFound.js` | Central 404 fallback handler for unmatched routes |
| `src/middleware/errorHandler.js` | Central 4-argument error handler preventing stack trace leakage |
| `docs/contributions/aravind.md` | This contribution document |

---

## Endpoints Implemented

| Method | Endpoint | Description | Success Code | Error Codes |
|--------|----------|-------------|--------------|-------------|
| GET | `/api/members` | List all registered members | 200 | 500 |
| GET | `/api/members/:id` | Get single member by positive integer ID | 200 | 400 (invalid ID), 404 (absent), 500 |
| POST | `/api/members` | Register new member (`name` required, `email` optional) | 201 | 400 (validation/JSON), 409 (duplicate email), 500 |

---

## Architecture & Implementation Details

### 1. App and Server Separation (`src/app.js` vs `src/server.js`)
- **`src/app.js`**: Constructs and configures the Express application (`express.json()`, mounts routers, registers `notFound` and `errorHandler`). It exports the `app` instance without binding to a network port. This enables automated testing tools (such as supertest or ephemeral HTTP servers) to import the application without opening a live TCP port.
- **`src/server.js`**: Acts as the production entrypoint. It imports `initDatabase` from `src/db/init.js` (Akshay's module), runs idempotent schema migrations, and only then starts the HTTP listener on `process.env.PORT || 3000`.

### 2. Route Integration
Route modules are registered at exact shared contract paths:
- `/api/members` → `members.routes.js` (Aravind)
- `/api/lockers` → `lockers.routes.js` (Manvith)
- `/api/allotments` → `allotments.routes.js` (Nevanesh)
- `/api/audit` → `audit.routes.js` (Manvith)

During distributed development, teammate route modules are loaded safely: when teammate branches merge into `main`, their routers are automatically mounted without code modifications.

### 3. Members APIs (`members.controller.js` & `members.routes.js`)
- **Positive Integer Validation**: `parsePositiveInteger(raw)` validates route parameters strictly, returning `400 Bad Request` with `{ "error": "ID must be a positive integer." }` for malformed IDs (e.g. `abc`, `0`, `-5`, `1.5`) rather than triggering database casting or 500 errors.
- **GET /api/members**: Executes parameterized query `SELECT id, name, email FROM members ORDER BY id ASC`, returning an array of member objects (or empty array `[]`) with HTTP 200.
- **GET /api/members/:id**: Retrieves member by ID using parameterized SQL (`WHERE id = ?`). Returns 200 on success or 404 with `{ "error": "Member with ID <id> not found." }` when not found.
- **POST /api/members**:
  - Requires non-empty trimmed `name` (string). Rejects empty, whitespace-only, or missing names with HTTP 400.
  - Accepts optional `email`. If provided, trims whitespace and stores `null` if empty.
  - Uses parameterized insertion (`INSERT INTO members (name, email) VALUES (?, ?)`).
  - Returns HTTP 201 with created record (`id`, `name`, `email`).
  - Gracefully catches SQLite unique constraint violations (`SQLITE_CONSTRAINT_UNIQUE`) on `email` and returns HTTP 409 `{ "error": "A member with this email already exists." }`.

### 4. Common Middleware
- **`src/middleware/notFound.js`**: Registered after all mounted routes. Catches any unhandled path/method and returns HTTP 404 with `{ "error": "Route not found: <METHOD> <URL>" }`.
- **`src/middleware/errorHandler.js`**: Central 4-parameter `(err, req, res, next)` error handler:
  - Handles JSON parse syntax errors from `express.json()` returning HTTP 400 (`Malformed JSON in request body.`).
  - Handles SQLite constraint errors (`SQLITE_CONSTRAINT_UNIQUE`, `SQLITE_CONSTRAINT_FOREIGNKEY`, `SQLITE_CONSTRAINT_NOTNULL`) safely returning 400/409.
  - Logs internal server errors server-side via `console.error` while returning a generic `{ "error": "Internal server error." }` HTTP 500 response to clients, preventing stack trace leakage.

### 5. Dependency & Package Management
- Only Aravind manages `package.json` and `package-lock.json`.
- Production dependencies: `express` (^4.21.2) and `better-sqlite3` (^11.8.1).
- Dev dependency: `nodemon` (^3.1.9).
- Scripts: `"start": "node src/server.js"`, `"dev": "nodemon src/server.js"`.

---

## Integration Dependencies & Coordination

| Dependency | Owner | Status / Notes |
|------------|-------|----------------|
| `src/db/database.js` | Akshay | Shared `better-sqlite3` database instance (`const db = require("../db/database")`) |
| `src/db/init.js` | Akshay | `initDatabase()` called by `server.js` prior to listening |
| `src/routes/lockers.routes.js` | Manvith | Mounted at `/api/lockers` |
| `src/routes/audit.routes.js` | Manvith | Mounted at `/api/audit` |
| `src/routes/allotments.routes.js` | Nevanesh | Mounted at `/api/allotments` |
| `src/middleware/lockerValidation.js` | Nevanesh | Validation middleware used by locker routes |
| `src/services/lockerSearch.js` | Nevanesh | Floor search service used by locker controller |
| `postman/`, `README.md` | Aditya | Postman collection, README, and testing documentation |

*Note: In accordance with the shared contract, no placeholder files were created for teammates' unmerged components. Full application startup (`node src/server.js`) awaits Akshay's database modules.*

---

## Commands Run

```bash
# 1. Switch to feature branch
git switch -c feature/aravind-server

# 2. Add dependencies and generate lockfile
npm install express better-sqlite3
npm install --save-dev nodemon

# 3. Verify files and execute unit/integration test suite
node scratch/test_members_and_app.js

# 4. Check status and diff
git status
git diff

# 5. Stage owned files only
git add package.json \
        package-lock.json \
        .gitignore \
        src/app.js \
        src/server.js \
        src/routes/members.routes.js \
        src/controllers/members.controller.js \
        src/middleware/notFound.js \
        src/middleware/errorHandler.js \
        docs/contributions/aravind.md

# 6. Commit
git commit -m "Set up Express server and members API"

# 7. Push feature branch to origin
git push -u origin feature/aravind-server
```

---

## Tests Run and Results

A comprehensive automated test suite (`scratch/test_members_and_app.js`) was executed against `src/app.js` and `members.controller.js` using an in-memory SQLite database matching the exact schema contract:

```text
PASS: app.js imported successfully without opening a port/listener.
Ephemeral test server running on http://127.0.0.1:59029

--- Testing GET /api/members (empty initially) ---
  PASS: Status is 200 (got 200)
  PASS: Returns empty array

--- Testing POST /api/members (valid create with email) ---
  PASS: Status is 201 (got 201)
  PASS: Member id is 1 (got 1)
  PASS: Member name is trimmed (got 'Aravind Gabbi')
  PASS: Member email is saved (got 'aravind@example.com')

--- Testing POST /api/members (valid create without email) ---
  PASS: Status is 201 (got 201)
  PASS: Member id is 2 (got 2)
  PASS: Member name is 'Jane Smith'
  PASS: Member email is null (got null)

--- Testing GET /api/members (list all) ---
  PASS: Status is 200 (got 200)
  PASS: Returns array of 2 members (got 2)

--- Testing GET /api/members/:id (existing member) ---
  PASS: Status is 200 (got 200)
  PASS: Returns member details correctly

--- Testing GET /api/members/:id (absent member 404) ---
  PASS: Status is 404 (got 404)
  PASS: Contains error message: 'Member with ID 999 not found.'

--- Testing GET /api/members/:id (malformed IDs 400) ---
  PASS: GET /api/members/abc returns 400 (got 400)
  PASS: Error message matches contract
  PASS: GET /api/members/-5 returns 400 (got 400)
  PASS: GET /api/members/0 returns 400 (got 400)
  PASS: GET /api/members/1.5 returns 400 (got 400)

--- Testing POST /api/members (invalid input 400) ---
  PASS: Empty trimmed name returns 400 (got 400)
  PASS: Clear explanation for name
  PASS: Missing name returns 400 (got 400)
  PASS: Non-string name returns 400 (got 400)
  PASS: Non-string email returns 400 (got 400)

--- Testing POST /api/members (duplicate email 409) ---
  PASS: Duplicate email returns 409 (got 409)
  PASS: Error explanation matches contract: 'A member with this email already exists.'

--- Testing Malformed JSON request body (400) ---
  PASS: Malformed JSON returns 400 (got 400)
  PASS: Error explanation: 'Malformed JSON in request body.'

--- Testing Unknown Route 404 middleware ---
  PASS: Unknown route returns 404 (got 404)
  PASS: Error explanation: 'Route not found: GET /api/unknown-endpoint'
  PASS: Unknown root path returns 404 (got 404)

========================================
TEST SUMMARY: 33 passed, 0 failed.
========================================
```

---

## Screenshot Checklist

- [ ] `git branch` showing `feature/aravind-server`
- [ ] `git log --oneline` showing commit "Set up Express server and members API"
- [ ] `git push` terminal output pushing `feature/aravind-server` to GitHub
- [ ] GitHub branch page showing `feature/aravind-server`
- [ ] GitHub Pull Request opened targeting `main`
- [ ] Terminal showing test suite passing (33 passed, 0 failed)
- [ ] Code screenshot: `src/app.js` and `src/server.js`
- [ ] Code screenshot: `src/controllers/members.controller.js`
- [ ] Code screenshot: `src/middleware/notFound.js` and `src/middleware/errorHandler.js`
- [ ] POST `/api/members` 201 response in Postman/curl
- [ ] GET `/api/members` 200 response in Postman/curl
- [ ] GET `/api/members/:id` 200 and 404 responses in Postman/curl
- [ ] POST duplicate email 409 conflict in Postman/curl
- [ ] Malformed ID 400 error in Postman/curl

---

## Verification Checklist

- [x] `package.json` created with `express`, `better-sqlite3`, and `nodemon`
- [x] `package-lock.json` generated
- [x] `.gitignore` updated with `node_modules/`, `.env`, `data/*.db`, logs, OS/editor noise
- [x] `src/app.js` created and exported without listening
- [x] `src/server.js` created with `initDatabase` call and port listener
- [x] `src/routes/members.routes.js` created
- [x] `src/controllers/members.controller.js` created
- [x] `src/middleware/notFound.js` created (returns 404 JSON)
- [x] `src/middleware/errorHandler.js` created (consistent JSON error shape, no stack trace)
- [x] Parameterized SQL used for all queries
- [x] Positive integer validation on `:id` parameter (returns 400 on invalid)
- [x] Duplicate email returns 409 Conflict
- [x] No placeholder files created for teammates
- [x] No edits made to other members' owned files
- [x] App import verified without starting listener
- [x] 33 test assertions passed

