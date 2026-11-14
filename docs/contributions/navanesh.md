# Navanesh – Contribution Document

## Role & Assigned Scope

**Allotment JOIN Endpoint, Reusable Locker Input Validation Middleware, and Floor-Based Search Service**

- **Member:** Navanesh
- **Branch:** `feature/nevanesh-validation`
- **Target Branch:** `main`

---

## Files Owned and Modified

Strict adherence to the ownership contract was maintained. No foreign files or package manifests were altered.

| File | Purpose |
|------|---------|
| `src/routes/allotments.routes.js` | Express route definition for `GET /api/allotments` |
| `src/controllers/allotments.controller.js` | Controller performing 3-table SQL INNER JOIN (`allotments` + `members` + `lockers`) |
| `src/middleware/lockerValidation.js` | Reusable Express middleware for validating and trimming `name` and `floor` on locker POST/PUT |
| `src/services/lockerSearch.js` | Reusable service for floor-based parameterized search and locker retrieval |
| `docs/contributions/navanesh.md` | This contribution and integration document |
| `docs/contributions/nevanesh.md` | Canonical reference copy matching assignment prompt specification |

---

## Technical Implementations & Architectural Design

### 1. Allotment JOIN Endpoint (`GET /api/allotments`)

#### Overview
Implemented the required allotment JOIN API at `GET /api/allotments` using an SQL `INNER JOIN` across the `allotments`, `members`, and `lockers` tables.

#### SQL Query & Column Aliases
The query selects the exact 8 fields specified in the shared API contract:
```sql
SELECT 
  a.id AS id,
  a.member_id AS member_id,
  m.name AS member_name,
  a.locker_id AS locker_id,
  l.name AS locker_name,
  l.floor AS floor,
  a.allotted_at AS allotted_at,
  a.returned_at AS returned_at
FROM allotments a
INNER JOIN members m ON a.member_id = m.id
INNER JOIN lockers l ON a.locker_id = l.id
ORDER BY a.id ASC;
```

#### Key Behaviors
- **Relationship Integrity:** Uses `INNER JOIN` as allotments strictly require both an existing member and locker.
- **Empty State:** When no allotment records exist, returns HTTP `200` with an empty JSON array `[]`.
- **Error Handling:** Propagates any database error cleanly via Express `next(err)` to Aravind's central `errorHandler.js` without leaking stack traces or internal implementation details to the client.

---

### 2. Reusable Locker Input Validation Middleware (`src/middleware/lockerValidation.js`)

#### Exported Function
```js
module.exports = { validateLocker };
```

#### Middleware Validation Rules
1. **Payload Structure:** Validates that `req.body` is a non-null JSON object and not an array.
2. **`name` Validation:**
   - Must exist (`!= null`). Missing returns `400` with `{ "error": "Locker name is required." }`.
   - Must be of type string (`typeof === "string"`). Non-string returns `400` with `{ "error": "Locker name must be a string." }`.
   - Must remain non-empty after trimming. Whitespace-only returns `400` with `{ "error": "Locker name cannot be empty or whitespace only." }`.
3. **`floor` Validation:**
   - Must exist (`!= null`). Missing returns `400` with `{ "error": "Floor is required." }`.
   - Must be of type string (`typeof === "string"`). Non-string returns `400` with `{ "error": "Floor must be a string." }`.
   - Must remain non-empty after trimming. Whitespace-only returns `400` with `{ "error": "Floor cannot be empty or whitespace only." }`.
4. **Sanitization:** Trims both `req.body.name` and `req.body.floor` and re-assigns the clean trimmed strings back onto `req.body` for downstream consumption by Manvith's controller.
5. **Flow Control:** Calls `next()` if and only if both fields are valid. Does not throw unhandled exceptions.

---

### 3. Reusable Floor-Search Service (`src/services/lockerSearch.js`)

#### Exported Functions
```js
module.exports = {
  getLockers,
  searchByFloor,
};
```

#### Service Signatures & Behavior
- **`getLockers(db, floor)` (also supports polymorphic `getLockers(floor)`):**
  - If `floor` is `undefined` or `null`: Executes `SELECT id, name, floor, status FROM lockers ORDER BY id ASC` to return all lockers.
  - If `floor` is provided: Trims whitespace and executes a parameterized SQL query:
    ```sql
    SELECT id, name, floor, status FROM lockers WHERE floor = ? ORDER BY id ASC
    ```
  - If `floor` trims to empty string `""`: Safely returns an empty array `[]`.
- **`searchByFloor(floor, db)`:**
  - Convenience wrapper directly compatible with Manvith's `lockers.controller.js` usage:
    ```js
    const lockerSearch = require("../services/lockerSearch");
    const lockers = lockerSearch.searchByFloor(floor.trim());
    ```
- **SQL Injection Prevention:** Query inputs are never concatenated into SQL strings. Every search value is bound via SQLite query parameters (`?`). Test payloads containing SQL injection vectors (e.g. `Ground' OR '1'='1` or `'; DROP TABLE lockers; --`) are treated strictly as string literals and safely produce zero matches without executing malicious SQL commands.

---

## Inter-Member Coordination & Integration Contracts

### Coordination with Manvith (Locker CRUD & Routes)
- **Validation Middleware Import in `src/routes/lockers.routes.js`:**
  ```js
  const { validateLocker } = require("../middleware/lockerValidation");
  // Attached to routes:
  router.post("/", validateLocker, createLocker);
  router.put("/:id", validateLocker, updateLocker);
  ```
- **Floor Search Service Import in `src/controllers/lockers.controller.js`:**
  ```js
  const { getLockers } = require("../services/lockerSearch");
  const lockers = getLockers(db, req.query.floor);
  // Also compatible with:
  const lockerSearch = require("../services/lockerSearch");
  const lockers = lockerSearch.searchByFloor(floor.trim());
  ```

### Coordination with Aravind (Server & Routing)
- **Route Mounting in `src/app.js`:**
  ```js
  const allotmentsRoutes = require("./routes/allotments.routes");
  app.use("/api/allotments", allotmentsRoutes);
  ```

### Coordination with Akshay (Database Connection)
- `src/controllers/allotments.controller.js` and `src/services/lockerSearch.js` import the single shared database connection:
  ```js
  const db = require("../db/database");
  ```

---

## Actual Unit Tests & Execution Results

Unit tests were conducted against an in-memory SQLite schema strictly adhering to the database contract. All 14 tests passed with zero failures.

```text
==========================================
RUNNING NAVANESH COMPONENT UNIT TESTS
==========================================

✔ [PASS] Test 1: Allotments JOIN returns expected member and locker names for seeded test relationships
✔ [PASS] Test 2: All required aliases/fields are present in allotment response
✔ [PASS] Test 3: Empty allotments returns [] and 200
✔ [PASS] Test 4: Valid locker name/floor passes middleware and trims whitespace
✔ [PASS] Test 5: Missing name returns 400 with clear message
✔ [PASS] Test 6: Non-string name returns 400
✔ [PASS] Test 7: Whitespace-only name returns 400
✔ [PASS] Test 8: Missing floor returns 400
✔ [PASS] Test 9: Non-string floor returns 400
✔ [PASS] Test 10: Whitespace-only floor returns 400
✔ [PASS] Test 11: Non-object body returns 400
✔ [PASS] Test 12: Floor search returns only the requested floor
✔ [PASS] Test 13: Search values containing quotes or SQL-looking text do not alter SQL behavior
✔ [PASS] Test 14: Search without floor returns all lockers

==========================================
TEST RESULTS: 14/14 PASSED
==========================================
```

### Verification with Manvith's Integration Code
A dedicated harness verified compatibility with Manvith's `lockers.routes.js` and `lockers.controller.js`:
```text
✔ Manvith integration interface verified successfully!
```

---

## Commands Run

```bash
# 1. Switch to main and update
git switch main
git pull --ff-only origin main

# 2. Configure local member identity
git config user.name "Navanesh"
git config user.email "navanesh@student.local"

# 3. Create assigned feature branch
git switch -c feature/nevanesh-validation

# 4. Verify branch and status
git status

# 5. Execute unit tests
node scratch/test_nevanesh.js

# 6. Stage assigned files
git add src/routes/allotments.routes.js \
        src/controllers/allotments.controller.js \
        src/middleware/lockerValidation.js \
        src/services/lockerSearch.js \
        docs/contributions/navanesh.md \
        docs/contributions/nevanesh.md

# 7. Commit with descriptive message
git commit -m "Add allotment join validation, floor search and navanesh contribution docs"

# 8. Push feature branch to origin
git push -u origin feature/nevanesh-validation
```

---

## Screenshot Checklist for Student Submission Document

The following items should be captured by the student for the individual faculty submission:
- [ ] Terminal showing `git switch -c feature/nevanesh-validation` and `git status`.
- [ ] Code screenshot of `src/middleware/lockerValidation.js`.
- [ ] Code screenshot of `src/services/lockerSearch.js`.
- [ ] Code screenshot of `src/controllers/allotments.controller.js` and `src/routes/allotments.routes.js`.
- [ ] Terminal output showing 14/14 unit tests passing.
- [ ] Terminal output of `git commit` and `git push -u origin feature/nevanesh-validation`.
- [ ] GitHub repository webpage showing `feature/nevanesh-validation` pushed.
- [ ] GitHub repository file tree showing `docs/contributions/navanesh.md`.
- [ ] Pull Request page on GitHub targeting `main` with summary and file diff.

---

## Self-Audit Checklist

- [x] Only assigned files were created and modified.
- [x] No modifications to `package.json`, `package-lock.json`, or other members' code.
- [x] All SQLite operations use parameterized queries (`?`).
- [x] Standard JSON error shape `{ "error": "..." }` used throughout.
- [x] No stack traces exposed to clients.
- [x] Unit test suite covers all 12 contract requirements plus extra validation checks.
- [x] Full integration state reported clearly.
