# Akshay – Contribution Document

## Role

**Database Engineer – SQLite Database Design, Shared Connection, Schema Creation, Relationships, Constraints, and Idempotent Initialization**

Branch: `feature/akshay-database`

---

## Files Owned

| File | Purpose |
|------|---------|
| `src/db/database.js` | Exports the single, shared `better-sqlite3` database instance with SQLite foreign keys enabled |
| `src/db/init.js` | Idempotently creates tables, constraints, partial unique indexes, and performance indexes |
| `docs/contributions/akshay.md` | This contribution document |

---

## Architecture & Database Design

### 1. Shared Database Connection (`src/db/database.js`)
- **Single Connection Instance**: Connects to `data/fitnest.db` using `better-sqlite3`. The connection is opened once and exported via CommonJS (`module.exports = db`). All controllers and services import this exact instance via `require("../db/database")`.
- **Directory Safety**: Before opening the database, `path.resolve(__dirname, "../../data")` is checked with `fs.existsSync()`; if missing, it is created with `fs.mkdirSync(dataDir, { recursive: true })`.
- **Foreign Key Enforcement**: SQLite disables foreign keys by default for backward compatibility. The shared connection explicitly enables them on startup:
  ```javascript
  db.pragma("foreign_keys = ON");
  ```
- **Security & Hygiene**: The database file `data/fitnest.db` is strictly ignored by Git in `.gitignore`. No database dumps, secrets, or binary files are committed.

### 2. Idempotent Schema Initialization (`src/db/init.js`)
- Exports a named function `initDatabase(targetDb = defaultDb)`.
- Uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` across all tables and indexes.
- Safe to run on every application startup or server restart without wiping existing records or corrupting the database.
- Does not seed mock or fake data automatically, preserving data integrity across teammate tests.

---

## Table & Column Specifications

### 1. `members` Table
Stores gym members who can be allotted lockers.

```sql
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique identifier for each member |
| `name` | `TEXT` | `NOT NULL` | Full member name (required string) |
| `email` | `TEXT` | `UNIQUE` | Optional contact email; unique when provided |

---

### 2. `lockers` Table
Stores locker units across gym floors.

```sql
CREATE TABLE IF NOT EXISTS lockers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  floor TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE'
);

CREATE INDEX IF NOT EXISTS idx_lockers_floor ON lockers(floor);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique identifier for each locker |
| `name` | `TEXT` | `NOT NULL` | Locker label (e.g. "Locker 101") |
| `floor` | `TEXT` | `NOT NULL` | Floor designation (e.g. "Ground", "First") |
| `status` | `TEXT` | `NOT NULL DEFAULT 'AVAILABLE'` | System status flag |

- **`idx_lockers_floor`**: Index on `floor` to optimize floor search queries (`GET /api/lockers?floor=Ground`).

---

### 3. `allotments` Table
Stores assignment records linking members to lockers over time.

```sql
CREATE TABLE IF NOT EXISTS allotments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  locker_id INTEGER NOT NULL REFERENCES lockers(id) ON DELETE RESTRICT,
  allotted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_at TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_allotments_active_locker
ON allotments(locker_id)
WHERE returned_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_allotments_active_member
ON allotments(member_id)
WHERE returned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_allotments_member_id ON allotments(member_id);
CREATE INDEX IF NOT EXISTS idx_allotments_locker_id ON allotments(locker_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique allotment identifier |
| `member_id` | `INTEGER` | `NOT NULL REFERENCES members(id) ON DELETE RESTRICT` | Foreign key referencing `members(id)` |
| `locker_id` | `INTEGER` | `NOT NULL REFERENCES lockers(id) ON DELETE RESTRICT` | Foreign key referencing `lockers(id)` |
| `allotted_at` | `TEXT` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Timestamp when locker was assigned |
| `returned_at` | `TEXT` | `NULL` | Nullable timestamp when locker was returned |

#### Partial Unique Indexes & Allotment Lifecycle
1. **`idx_allotments_active_locker` (`WHERE returned_at IS NULL`)**:
   - Enforces that a locker can have **at most one active allotment** at any time.
   - Prevents double-booking a locker.
   - Once a locker is returned (`UPDATE allotments SET returned_at = CURRENT_TIMESTAMP`), the partial index condition is no longer met, allowing the locker to be allotted again in a new record while preserving complete historical records.
2. **`idx_allotments_active_member` (`WHERE returned_at IS NULL`)**:
   - Enforces that a gym member can hold **at most one active locker** at any time.
   - Once the member returns their locker, they are eligible to receive another.
3. **Lookup Indexes (`idx_allotments_member_id`, `idx_allotments_locker_id`)**:
   - Drastically accelerates the allotment join endpoint (`GET /api/allotments` joining `allotments` + `members` + `lockers`).

#### Foreign Key Protection (`ON DELETE RESTRICT`)
- If a locker or member has allotment history in `allotments`, deleting that locker or member is blocked by SQLite (`SQLITE_CONSTRAINT_FOREIGNKEY` / HTTP 409).
- Historical allotments are never silently cascade-deleted.

---

### 4. `locker_audit` Table
Stores permanent audit logs of all locker lifecycle mutations (`CREATE`, `UPDATE`, `DELETE`).

```sql
CREATE TABLE IF NOT EXISTS locker_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  locker_id INTEGER NOT NULL,
  time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locker_audit_locker_id ON locker_audit(locker_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Auto-incrementing primary key (used as insertion-order tie-breaker) |
| `action` | `TEXT` | `NOT NULL` | Mutation type (`CREATE`, `UPDATE`, `DELETE`) |
| `locker_id` | `INTEGER` | `NOT NULL` | The ID of the locker affected |
| `time` | `TEXT` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | UTC timestamp of the mutation |

#### Why `locker_audit.locker_id` Intentionally Omits a Foreign Key
- In `lockerAudit.service.js`, when a locker is deleted, an audit record with `action = 'DELETE'` and `locker_id = <deletedId>` is written.
- If `locker_audit` had a foreign key constraint `REFERENCES lockers(id)`, SQLite would reject deleting the locker (`ON DELETE RESTRICT`) or would wipe the audit history (`ON DELETE CASCADE`).
- By **intentionally omitting** the foreign key from `locker_audit` to `lockers`, audit history remains immutable and permanent even after the physical locker row is deleted.

---

## Integration Interface with Teammates

| Teammate | Role | Interface Contract |
|----------|------|--------------------|
| **Aravind** | Team Lead & Server Bootstrap | In `src/server.js`, imports `const { initDatabase } = require("./db/init");` and calls `initDatabase()` before starting `app.listen()`. |
| **Aravind** | Members API | In `src/controllers/members.controller.js`, imports `const db = require("../db/database");` to query `members`. |
| **Manvith** | Locker CRUD & Audit Service | In `src/controllers/lockers.controller.js` and `src/services/lockerAudit.service.js`, imports `const db = require("../db/database");` to execute locker mutations and audit inserts in atomic `db.transaction()` blocks. |
| **Nevanesh** | Allotment Join & Validation | In `src/controllers/allotments.controller.js`, imports `const db = require("../db/database");` to execute multi-table JOINs on `allotments`, `members`, and `lockers`. |
| **Aditya** | Postman & Documentation | Uses the database schema contracts and constraints to build automated Postman test runs and verify status codes (200, 201, 400, 404, 409). |

---

## Commands Run

```bash
# 1. Fetch remote repository status
git status
git fetch origin

# 2. Configure identity for student G. AKSHAY
git config user.name "GEDDAPU AKSHAY"
git config user.email "akshayjohn4518@gmail.com"

# 3. Create local main branch tracking origin/feature/aravind-server
git checkout -b main origin/feature/aravind-server

# 4. Create and switch to assigned feature branch
git switch -c feature/akshay-database

# 5. Create database connection and schema initialization modules
# - src/db/database.js
# - src/db/init.js

# 6. Execute automated verification test suite
node test_database_layer.js

# 7. Verify Express application startup and endpoint integration
node -e "const app = require('./src/app'); const { initDatabase } = require('./src/db/init'); initDatabase(); const server = app.listen(3099, () => { console.log('OK'); server.close(); });"

# 8. Check git diff and stage only assigned files
git status
git add src/db/database.js src/db/init.js docs/contributions/akshay.md

# 9. Commit
git commit -m "Create SQLite database schema and relationships"

# 10. Push feature branch to origin
git push -u origin feature/akshay-database
```

---

## Tests Run and Actual Results

An automated test suite was executed against the database layer covering all structural, relational, and constraint requirements:

```text
==========================================================
FitNest Database Layer Test Suite (Akshay - Database Engineer)
==========================================================

--- Section 1: Schema Creation & Idempotence ---
  [PASS] Foreign keys are enabled
  [PASS] All four agreed tables exist after initialization
  [PASS] Running initDatabase a second time is completely safe (idempotent)
  [PASS] Members table columns and constraints
  [PASS] Lockers table columns and defaults
  [PASS] Allotments table foreign keys and nullability
  [PASS] Locker audit table structure and intentional absence of FK
  [PASS] Indexes exist for partial unique constraints and performance

--- Section 2: Relational Integrity & Data Insertion ---
  [PASS] Insert member with unique email and member without email
  [PASS] Insert lockers with default status

--- Section 3: Allotment Partial Unique Constraints ---
  [PASS] Create valid active allotment referencing member and locker
  [PASS] Reject duplicate active allotment for the SAME LOCKER (Locker 101 is busy)
  [PASS] Reject duplicate active allotment for the SAME MEMBER (Member 1 already has active locker)
  [PASS] Returning a locker allows subsequent active allotments for both member and locker

--- Section 4: Foreign Key Enforcement & ON DELETE RESTRICT ---
  [PASS] Reject allotment referencing non-existent member or locker
  [PASS] Reject deleting locker that has allotment history (ON DELETE RESTRICT)
  [PASS] Reject deleting member that has allotment history (ON DELETE RESTRICT)

--- Section 5: Audit Survivability & Joins ---
  [PASS] Unreferenced locker can be deleted and its audit log survives
  [PASS] Allotments JOIN query returns exact contract structure

--- Section 6: Shared Database Module Verification ---
  [PASS] Shared connection initializes data/fitnest.db with foreign keys

==========================================================
Summary: 20 passed, 0 failed out of 20 assertions.
==========================================================
```

### Server & Express Integration Verification
```text
Server started cleanly on port 3099
GET /api/members response: []
```

---

## Screenshot Checklist

- [ ] `git branch` showing `feature/akshay-database`
- [ ] `git log --oneline` showing commit "Create SQLite database schema and relationships"
- [ ] `git push -u origin feature/akshay-database` terminal output
- [ ] GitHub branch page showing `feature/akshay-database`
- [ ] GitHub Pull Request opened targeting `main`
- [ ] Terminal showing test suite passing (20 passed, 0 failed)
- [ ] Code screenshot: `src/db/database.js` showing connection and `PRAGMA foreign_keys = ON`
- [ ] Code screenshot: `src/db/init.js` showing table definitions, foreign keys, and partial unique indexes
- [ ] SQLite CLI / GUI showing all 4 tables (`members`, `lockers`, `allotments`, `locker_audit`) and indexes in `data/fitnest.db`
- [ ] Terminal / Postman showing constraint enforcement (duplicate active locker allotment rejected with UNIQUE constraint error)
- [ ] Terminal / Postman showing `ON DELETE RESTRICT` blocking deletion of locker with allotment history

---

## Final Verification Checklist

- [x] `src/db/database.js` created and exports single `better-sqlite3` instance
- [x] Directory `data/` created safely with recursive mkdir
- [x] `PRAGMA foreign_keys = ON` enabled on connection
- [x] `src/db/init.js` created with named export `initDatabase`
- [x] Schema initialization is 100% idempotent (`CREATE TABLE/INDEX IF NOT EXISTS`)
- [x] All 4 agreed tables defined with exact columns, constraints, and data types
- [x] Partial unique index on `allotments(locker_id) WHERE returned_at IS NULL` implemented and verified
- [x] Partial unique index on `allotments(member_id) WHERE returned_at IS NULL` implemented and verified
- [x] Foreign keys configured with `ON DELETE RESTRICT`
- [x] `locker_audit` table intentionally omits foreign key to `lockers`
- [x] Floor search and allotment join indexes created
- [x] No fake/seed records automatically inserted
- [x] No modifications to `package.json` or `package-lock.json`
- [x] No edits made to other teammates' files
- [x] Only owned files staged and committed
- [x] 20 automated test assertions passed
