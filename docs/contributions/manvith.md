# Manvith – Contribution Document

## Role

**Locker CRUD APIs, Audit Endpoint and Transactional Audit Logging**

Branch: `feature/manvith-lockers`

---

## Files Owned

| File | Purpose |
|------|---------|
| `src/routes/lockers.routes.js` | Express router for all locker endpoints |
| `src/controllers/lockers.controller.js` | Business logic for locker CRUD |
| `src/routes/audit.routes.js` | Express router for `GET /api/audit` |
| `src/controllers/audit.controller.js` | Business logic for audit endpoint |
| `src/services/lockerAudit.service.js` | Atomic better-sqlite3 transaction service |
| `docs/contributions/manvith.md` | This contribution document |

---

## Endpoints Implemented

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| GET | `/api/lockers` | List all lockers; optional `?floor=` filter | 200 |
| GET | `/api/lockers/:id` | Get one locker by ID | 200 / 404 / 400 |
| POST | `/api/lockers` | Create locker + CREATE audit | 201 |
| PUT | `/api/lockers/:id` | Update locker + UPDATE audit | 200 / 404 / 400 |
| DELETE | `/api/lockers/:id` | Delete locker + DELETE audit | 200 / 404 / 400 / 409 |
| GET | `/api/audit` | Latest 10 audit rows, newest first | 200 |

---

## Controller / Service Design

### `lockers.controller.js`

- **`parseId(raw)`** – validates route params are positive integers, returns `null` for invalid input (triggers HTTP 400).
- **GET all** – delegates floor-filter to `lockerSearch.searchByFloor()` (Nevanesh's service); falls back to full table scan when no floor is supplied.
- **GET one** – validates ID, 404 on miss.
- **POST** – trims name/floor (validation already done by middleware), calls `auditService.createLockerWithAudit()`, returns 201 + created row.
- **PUT** – validates ID, calls `auditService.updateLockerWithAudit()`, returns 200 + updated row or 404.
- **DELETE** – validates ID, calls `auditService.deleteLockerWithAudit()`, maps `null` → 404, `'REFERENCED'` → 409, `{deleted:true}` → 200.

### `lockerAudit.service.js`

Each exported function wraps its database operations in a `db.transaction(...)` call (better-sqlite3 synchronous transactions):

```
createLockerWithAudit(name, floor)
  → BEGIN
  → INSERT INTO lockers ... → lastInsertRowid
  → INSERT INTO locker_audit (action='CREATE', locker_id)
  → SELECT * FROM lockers WHERE id = lastInsertRowid
  → COMMIT  (or ROLLBACK on any error)

updateLockerWithAudit(id, name, floor)
  → BEGIN
  → UPDATE lockers SET name=?, floor=? WHERE id=?  → check changes
  → INSERT INTO locker_audit (action='UPDATE', locker_id)
  → SELECT * FROM lockers WHERE id=?
  → COMMIT  (or ROLLBACK on any error)

deleteLockerWithAudit(id)
  → BEGIN
  → SELECT id FROM lockers WHERE id=?    (existence check)
  → INSERT INTO locker_audit (action='DELETE', locker_id=id)
  → DELETE FROM lockers WHERE id=?       (FK violation → caught → ROLLBACK → return 'REFERENCED')
  → COMMIT

getLatestAudit()
  → SELECT action, locker_id, time FROM locker_audit ORDER BY id DESC LIMIT 10
```

> **Why audit-before-delete?**  
> Writing the DELETE audit row *before* deleting the locker row is intentional. If the DELETE fails (FK violation), better-sqlite3 automatically rolls back the entire transaction, so the orphaned audit row is never committed. The audit record is only visible after a successful `COMMIT`.

---

## Transaction Atomicity

`better-sqlite3`'s `db.transaction()` returns a wrapped function. When called:
- All inner statements run in one BEGIN/COMMIT block.
- Any thrown error triggers an automatic ROLLBACK.
- This guarantees: **audit row ↔ locker mutation are either both written or both absent.**

---

## Integration Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| `src/db/database.js` | Akshay | **Required** – shared connection; imported as `require("../db/database")` |
| `src/db/init.js` | Akshay | **Required** – creates tables including `lockers` and `locker_audit` |
| `src/middleware/lockerValidation.js` | Nevanesh | **Required** – `validateLocker` export used on POST and PUT routes |
| `src/services/lockerSearch.js` | Nevanesh | **Required** – `searchByFloor(floor)` called for `?floor=` queries |
| `src/app.js` | Aravind | **Required** – must mount `lockers.routes.js` at `/api/lockers` and `audit.routes.js` at `/api/audit` |

---

## Commands Run

```bash
# 1. Clone repository
git clone https://github.com/Dark-Passenger-07/Fitnest-gym-locker-system

# 2. Configure identity
git config user.email "manvith@student.local"
git config user.name "Manvith"

# 3. Check remote state (repo was empty on clone)
git fetch origin
git branch -a

# 4. Create feature branch from initial state
git switch -c feature/manvith-lockers

# 5. Stage only owned files
git add src/routes/lockers.routes.js \
        src/controllers/lockers.controller.js \
        src/routes/audit.routes.js \
        src/controllers/audit.controller.js \
        src/services/lockerAudit.service.js \
        docs/contributions/manvith.md \
        .gitignore

# 6. Commit
git commit -m "Implement locker CRUD and transactional audit trail"

# 7. Push feature branch
git push -u origin feature/manvith-lockers
```

---

## Test Plan (to be executed once integration is complete)

> Tests below require Akshay's `database.js`/`init.js` and Aravind's `app.js`/`server.js` to be present and running. They are not yet merged; results will be recorded once the full application is integrated.

### Test commands (curl-based)

```bash
BASE=http://localhost:3000/api

# --- Setup: start server ---
# node src/server.js

# 1. POST valid locker → 201
curl -s -X POST $BASE/lockers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test-L1","floor":"Ground"}' | jq .

# 2. PUT that locker → 200
# (replace 1 with actual returned id)
curl -s -X PUT $BASE/lockers/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Test-L1-Updated","floor":"First"}' | jq .

# 3. GET /api/audit → 200, latest 2 rows = UPDATE then CREATE (same locker id)
curl -s $BASE/audit | jq .

# 4. GET all lockers → 200 array
curl -s $BASE/lockers | jq .

# 5. GET one locker → 200
curl -s $BASE/lockers/1 | jq .

# 6. Invalid IDs → 400
curl -s $BASE/lockers/abc | jq .
curl -s $BASE/lockers/-5 | jq .
curl -s $BASE/lockers/0  | jq .

# 7. Missing fields → 400 (Nevanesh middleware)
curl -s -X POST $BASE/lockers \
  -H "Content-Type: application/json" \
  -d '{"name":"   "}' | jq .

# 8. Floor filter
curl -s "$BASE/lockers?floor=Ground" | jq .

# 9. DELETE → 200, audit row persists
curl -s -X DELETE $BASE/lockers/1 | jq .
curl -s $BASE/audit | jq .   # DELETE row should appear

# 10. Referenced locker DELETE → 409
# (create locker, create allotment referencing it, then try DELETE)

# 11. Audit never > 10 rows
# (insert 12 lockers, check audit returns exactly 10)
curl -s $BASE/audit | jq 'length'
```

> **Note:** Actual test output screenshots will be captured and attached in the student faculty document once the complete application is running.

---

## Screenshot Checklist

- [ ] `git branch` showing `feature/manvith-lockers`
- [ ] `git log --oneline` showing commit
- [ ] `git push` terminal output
- [ ] GitHub branch page showing `feature/manvith-lockers`
- [ ] GitHub Pull Request opened targeting `main`
- [ ] Server startup (`node src/server.js`) terminal
- [ ] POST `/api/lockers` → 201 response
- [ ] PUT `/api/lockers/:id` → 200 response
- [ ] GET `/api/audit` → shows UPDATE then CREATE rows
- [ ] GET `/api/lockers` → 200 array
- [ ] GET `/api/lockers/:id` → 200 single object
- [ ] GET `/api/lockers/abc` → 400 error
- [ ] POST with missing fields → 400 (middleware active)
- [ ] GET `/api/lockers?floor=Ground` → filtered array
- [ ] DELETE → 200, then GET `/api/audit` shows DELETE row
- [ ] DELETE referenced locker → 409

---

## Checklist

- [x] `src/routes/lockers.routes.js` created
- [x] `src/controllers/lockers.controller.js` created
- [x] `src/routes/audit.routes.js` created
- [x] `src/controllers/audit.controller.js` created
- [x] `src/services/lockerAudit.service.js` created
- [x] All mutations use `db.transaction()` for atomicity
- [x] Audit rows survive locker deletion (no FK to lockers table)
- [x] DELETE audit captured before deletion, rolled back on FK violation
- [x] No duplicate files for Nevanesh's or Akshay's modules
- [x] No edits to others' owned files
- [x] No `package.json` / `package-lock.json` changes
- [x] `data/` in `.gitignore`
- [x] No stack traces exposed to clients
- [x] Parameterized SQL throughout
- [ ] Integration tests run (blocked on: Akshay's db files + Aravind's app bootstrap + Nevanesh's middleware/service)
