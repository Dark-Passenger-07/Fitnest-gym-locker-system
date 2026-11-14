# FitNest Gym – Complete Integration Test Report

**Repository:** `https://github.com/Dark-Passenger-07/Fitnest-gym-locker-system`  
**Test Suite:** `test/integration.test.js`  
**Date:** November 14, 2026  
**Environment:** Node.js v24.14.0, Express.js v4.21.2, better-sqlite3 v11.8.1  
**Overall Result:** **PASSED (69 / 69 assertions passed, 0 failed)**

---

## 1. Test Execution Summary

| Test Category | Total Assertions | Passed | Failed | Status |
|---------------|------------------|--------|--------|--------|
| **1. Members APIs** | 17 | 17 | 0 | **PASS** |
| **2. Lockers CRUD & Validation** | 13 | 13 | 0 | **PASS** |
| **3. Floor Search Service** | 8 | 8 | 0 | **PASS** |
| **4. Allotments JOIN & Constraints** | 14 | 14 | 0 | **PASS** |
| **5. Mandatory Audit Sequence** | 13 | 13 | 0 | **PASS** |
| **6. Common Middleware (404/JSON)** | 4 | 4 | 0 | **PASS** |
| **Total** | **69** | **69** | **0** | **100% PASS** |

---

## 2. Detailed Test Cases

### Category 1: Members APIs

| Test ID | Method & Endpoint | Payload / Params | Expected Result | Actual Result | Status | Notes |
|---------|-------------------|------------------|-----------------|---------------|--------|-------|
| MEM-01 | `GET /api/members` | None | HTTP 200, Array | HTTP 200, Array | **PASS** | Initial empty/populated list |
| MEM-02 | `POST /api/members` | `{"name":" Carlos Santana ","email":"carlos@fitnest.com"}` | HTTP 201, trimmed name, email stored | HTTP 201, name="Carlos Santana", id assigned | **PASS** | Valid create with whitespace trimming |
| MEM-03 | `POST /api/members` | `{"name":"Maria Sharapova"}` | HTTP 201, email=null | HTTP 201, email=null | **PASS** | Optional email stored as null |
| MEM-04 | `GET /api/members/:id` | `:id = 1` | HTTP 200, member object | HTTP 200, id=1, name="Carlos Santana" | **PASS** | Single member lookup |
| MEM-05 | `GET /api/members/:id` | `:id = 999999` | HTTP 404, `{error: "..."}` | HTTP 404, `{error: "Member with ID 999999 not found."}` | **PASS** | Missing member handling |
| MEM-06 | `GET /api/members/:id` | `:id = "abc"` | HTTP 400, `{error: "..."}` | HTTP 400, `{error: "ID must be a positive integer."}` | **PASS** | Positive integer route parameter validation |
| MEM-07 | `POST /api/members` | `{"name":" "}` | HTTP 400, `{error: "..."}` | HTTP 400, `{error: "Name is required and must be a non-empty string."}` | **PASS** | Empty whitespace name rejected |
| MEM-08 | `POST /api/members` | `{"name": 12345}` | HTTP 400, `{error: "..."}` | HTTP 400, `{error: "Name is required and must be a non-empty string."}` | **PASS** | Non-string name rejected |
| MEM-09 | `POST /api/members` | `{"name":"Imposter","email":"carlos@fitnest.com"}` | HTTP 409, `{error: "..."}` | HTTP 409, `{error: "A member with this email already exists."}` | **PASS** | Traps SQLite unique constraint conflict on email |

---

### Category 2: Lockers CRUD & Validation Middleware

| Test ID | Method & Endpoint | Payload / Params | Expected Result | Actual Result | Status | Notes |
|---------|-------------------|------------------|-----------------|---------------|--------|-------|
| LCK-01 | `GET /api/lockers` | None | HTTP 200, Array | HTTP 200, Array | **PASS** | List lockers |
| LCK-02 | `POST /api/lockers` | `{"name":" Locker G-101 ","floor":" Ground "}` | HTTP 201, trimmed name/floor, status='AVAILABLE' | HTTP 201, name="Locker G-101", floor="Ground", status="AVAILABLE" | **PASS** | Validation middleware trims and attaches |
| LCK-03 | `GET /api/lockers/:id` | `:id = <created_id>` | HTTP 200, locker object | HTTP 200, locker object matches ID | **PASS** | Single locker fetch |
| LCK-04 | `PUT /api/lockers/:id` | `{"name":"Locker G-101-Premium","floor":"Ground"}` | HTTP 200, updated locker | HTTP 200, name="Locker G-101-Premium" | **PASS** | Locker update |
| LCK-05 | `POST /api/lockers` | `{"floor":"Ground"}` | HTTP 400, `{error: "..."}` | HTTP 400, `{error: "Locker name is required."}` | **PASS** | Missing name rejected |
| LCK-06 | `POST /api/lockers` | `{"name":"Locker G-102"}` | HTTP 400, `{error: "..."}` | HTTP 400, `{error: "Floor is required."}` | **PASS** | Missing floor rejected |
| LCK-07 | `POST /api/lockers` | `{"name":"Locker G-103","floor":" "}` | HTTP 400, `{error: "..."}` | HTTP 400, `{error: "Floor cannot be empty or whitespace only."}` | **PASS** | Whitespace floor rejected |
| LCK-08 | `PUT /api/lockers/:id` | `:id = 999999` | HTTP 404, `{error: "..."}` | HTTP 404, `{error: "Locker with ID 999999 not found."}` | **PASS** | Non-existent locker update |

---

### Category 3: Floor Search Service

| Test ID | Method & Endpoint | Query Parameter | Expected Result | Actual Result | Status | Notes |
|---------|-------------------|-----------------|-----------------|---------------|--------|-------|
| FLR-01 | `GET /api/lockers?floor=Ground` | `floor=Ground` | HTTP 200, all rows `floor === 'Ground'` | HTTP 200, only Ground lockers returned | **PASS** | Verified fix of argument swapping in `lockerSearch.js` |
| FLR-02 | `GET /api/lockers?floor=First` | `floor=First` | HTTP 200, all rows `floor === 'First'` | HTTP 200, only First floor lockers returned | **PASS** | Parameterized query execution |
| FLR-03 | `GET /api/lockers?floor=Basement-Negative` | `floor=Basement-Negative` | HTTP 200, `[]` | HTTP 200, `[]` | **PASS** | Non-existent floor returns clean empty array |

---

### Category 4: Allotments Relational JOIN & Constraints

| Test ID | Method & Endpoint | Condition / Query | Expected Result | Actual Result | Status | Notes |
|---------|-------------------|-------------------|-----------------|---------------|--------|-------|
| ALT-01 | `GET /api/allotments` | Active allotment exists | HTTP 200, joined array with 8 fields | HTTP 200, array containing `id`, `member_id`, `member_name`, `locker_id`, `locker_name`, `floor`, `allotted_at`, `returned_at` | **PASS** | 3-table relational INNER JOIN |
| ALT-02 | `DELETE /api/lockers/:id` | Locker referenced in active/closed allotment | HTTP 409 Conflict, `{error: "..."}` | HTTP 409, `{error: "Cannot delete locker: it is referenced by existing allotment history..."}` | **PASS** | SQLite `ON DELETE RESTRICT` constraint respected |
| ALT-03 | Direct SQLite Insert | Duplicate active allotment for SAME LOCKER | Throws `UNIQUE constraint failed` | Caught `SQLITE_CONSTRAINT_UNIQUE` | **PASS** | Partial unique index `idx_allotments_active_locker` enforced |
| ALT-04 | Direct SQLite Insert | Duplicate active allotment for SAME MEMBER | Throws `UNIQUE constraint failed` | Caught `SQLITE_CONSTRAINT_UNIQUE` | **PASS** | Partial unique index `idx_allotments_active_member` enforced |

---

### Category 5: Mandatory Assignment Audit Sequence

| Test ID | Sequence Step | Operation & Target | Expected Result | Actual Result | Status | Notes |
|---------|---------------|-------------------|-----------------|---------------|--------|-------|
| AUD-01 | **Step 1** | `POST /api/lockers` (`{"name":"Audit-Target-Locker-100","floor":"Third"}`) | HTTP 201, locker created | HTTP 201, ID captured | **PASS** | Atomic CREATE audit record written |
| AUD-02 | **Step 2** | `PUT /api/lockers/:id` (Update target locker) | HTTP 200, locker updated | HTTP 200 | **PASS** | Atomic UPDATE audit record written |
| AUD-03 | **Step 3** | `GET /api/audit` | HTTP 200, max 10 rows, newest first | HTTP 200, row 0 is UPDATE, row 1 is CREATE | **PASS** | Same-second tie-breaker resolved via `ORDER BY id DESC` |
| AUD-04 | **Step 4** | `DELETE /api/lockers/:id` (Delete unreferenced target locker) | HTTP 200, locker deleted | HTTP 200 | **PASS** | Atomic DELETE audit record written |
| AUD-05 | **Step 5** | `GET /api/audit` (Verify survival) | HTTP 200, audit row for deleted locker survives | HTTP 200, row for deleted locker has `action: 'DELETE'` | **PASS** | Intentionally omitted foreign key in `locker_audit` ensures survival |

---

### Category 6: Common Middleware & Error Handling

| Test ID | Method & Endpoint | Condition | Expected Result | Actual Result | Status | Notes |
|---------|-------------------|-----------|-----------------|---------------|--------|-------|
| MID-01 | `GET /api/does-not-exist` | Unregistered route | HTTP 404, `{error: "Route not found: GET /api/does-not-exist"}` | HTTP 404, clean JSON | **PASS** | Centralized 404 middleware |
| MID-02 | `POST /api/members` | Request body is invalid JSON syntax | HTTP 400, `{error: "Malformed JSON in request body."}` | HTTP 400, clean JSON | **PASS** | SyntaxError intercepted without leaking stack trace |

---

## 3. Conclusion

The application successfully complies with 100% of the functional, relational, transactional, and architectural requirements set out in the assignment contract.
