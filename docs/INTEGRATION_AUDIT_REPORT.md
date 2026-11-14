# FitNest Gym – Complete Code & Integration Audit Report

**Repository:** `https://github.com/Dark-Passenger-07/Fitnest-gym-locker-system`  
**Auditor:** Senior Backend Engineer & Git Integration Engineer  
**Role / Owner:** Aravind (Team Lead)  
**Date:** November 14, 2026  
**Integration Target Branch:** `main`  

---

## 1. Executive Summary

A comprehensive multi-member code audit was performed on the integrated `main` branch following merges from `feature/aravind-server`, `feature/manvith-lockers`, and `feature/nevanesh-validation`.

The audit evaluated compliance against the mandatory assignment contract:
- Server startup and CommonJS modularity.
- SQLite connection handling, foreign keys, idempotent initialization, and partial unique indexes.
- Locker CRUD endpoints, floor search filtering, and validation middleware.
- Atomicity of locker mutation and audit logging within synchronous SQLite transactions.
- Allotment JOIN queries across members and lockers.
- Error shapes, HTTP status codes, and security hygiene (no stack traces or unhandled promises).
- Postman collections, environment configuration, and README documentation.

Eight issues across four severity levels were detected, analyzed, and documented below.

---

## 2. Detailed Findings and Audit Issues

### Issue ISS-01: SQLite Database and Schema Initializer Missing from `main`
- **Severity:** Critical
- **Module:** Database Layer
- **File:** `src/db/database.js`, `src/db/init.js`
- **Problem:** Attempting to start the application via `npm start` or import `src/server.js` throws `Error: Cannot find module './db/init'`. All controllers attempting to query the database fail with `Cannot find module '../db/database'`.
- **Root Cause:** Akshay completed the database implementation on `feature/akshay-database` (commit `27a3524`), but this feature branch was not yet merged into `main`.
- **Impact:** Complete system blocker: server cannot boot, schema cannot be initialized, and no endpoint can query data.
- **Fix:** Integrate Akshay's verified database connection module (`src/db/database.js`), idempotent initializer (`src/db/init.js`), and contribution documentation (`docs/contributions/akshay.md`) onto `main`.
- **Verification:** Start `server.js`, verify `initDatabase()` creates `data/fitnest.db` with all 4 tables and partial unique indexes, and verify foreign key pragmas are active.

---

### Issue ISS-02: Inverted Parameter Bug in `lockerSearch.searchByFloor`
- **Severity:** High
- **Module:** Services / Locker Search
- **File:** `src/services/lockerSearch.js` (Lines 81–83)
- **Problem:** `GET /api/lockers?floor=<value>` returns all lockers in the database rather than filtering by the requested floor.
- **Root Cause:** In `src/services/lockerSearch.js`, `searchByFloor` is declared as:
  ```javascript
  function searchByFloor(floor, db) {
    return getLockers(db, floor);
  }
  ```
  `lockers.controller.js` invokes `lockerSearch.searchByFloor(floor.trim())`, passing only one argument (`floor`). `searchByFloor` then invokes `getLockers(db, floor)` where `db` is `undefined` and `floor` is the actual string. Inside `getLockers(dbOrFloor, maybeFloor)`:
  - `dbOrFloor` receives `undefined`.
  - The fallback branch sets `floor = dbOrFloor` (`undefined`).
  - Line 49 checks `if (floor === undefined || floor === null)` and branches directly into returning all lockers unfiltered:
    `SELECT id, name, floor, status FROM lockers ORDER BY id ASC`
- **Impact:** The floor filtering query parameter `?floor=` is completely ineffective, returning the entire inventory.
- **Fix:** Correct the parameter order in `searchByFloor` and make `getLockers` resilient to single-argument string calls:
  ```javascript
  function searchByFloor(floor, db) {
    return getLockers(floor, db);
  }
  ```
  And in `getLockers`, properly differentiate when the first argument is a string versus a database instance.
- **Verification:** Seed lockers on multiple floors ("Ground", "First", "Second") and verify `GET /api/lockers?floor=Ground` returns only Ground floor lockers.

---

### Issue ISS-03: Silent Module Suppressions in `src/app.js`
- **Severity:** Medium
- **Module:** Express Setup
- **File:** `src/app.js` (Lines 18–33)
- **Problem:** Route modules are loaded via a `loadRoute()` helper that catches `MODULE_NOT_FOUND` and swallows it, returning `null`.
- **Root Cause:** `loadRoute()` was originally introduced during independent feature branch development before all teammates had merged. In the final integrated system, if an internal route dependency (e.g. controller or service) fails to load, `loadRoute` silently swallows the error and leaves the route unmounted, causing all endpoint requests to return 404 with no console error.
- **Impact:** Masks integration runtime errors and prevents fast-failure diagnostics during development and testing.
- **Fix:** Replace dynamic `loadRoute()` calls with explicit, direct CommonJS `require` statements for all 4 contract routes:
  ```javascript
  const membersRoutes = require("./routes/members.routes");
  const lockersRoutes = require("./routes/lockers.routes");
  const allotmentsRoutes = require("./routes/allotments.routes");
  const auditRoutes = require("./routes/audit.routes");
  ```
- **Verification:** Verify that all 4 route trees are mounted explicitly and that syntax or import errors in submodules fail loudly at startup.

---

### Issue ISS-04: Stale `try/catch` Database Loading in Allotments Controller
- **Severity:** Medium
- **Module:** Controllers
- **File:** `src/controllers/allotments.controller.js` (Lines 23–28)
- **Problem:** `allotments.controller.js` caches `defaultDb = require("../db/database")` inside a top-level `try/catch`. If evaluated before the database file exists, `defaultDb` is permanently cached as `null`, causing subsequent requests to fail with `500 Database connection is not available` even after the database is created.
- **Root Cause:** Pre-merge defensive code was left in place after branch integration.
- **Impact:** Fragile connection binding; requires application restart if database module load order fluctuates.
- **Fix:** Unconditionally require the shared database module:
  ```javascript
  const db = require("../db/database");
  ```
- **Verification:** Request `GET /api/allotments` and verify it queries the shared database connection directly and reliably.

---

### Issue ISS-05: Missing Postman Collection and Environment Files
- **Severity:** High
- **Module:** API Testing / Delivery
- **File:** `postman/FitNest_Gym.postman_collection.json`, `postman/FitNest_Gym.postman_environment.json`
- **Problem:** The `postman/` directory is missing from the repository.
- **Root Cause:** Aditya's assigned contribution was not committed or merged into `main`.
- **Impact:** External testers, grading scripts, and QA engineers cannot import the standardized collection, execute the 3-step audit test sequence, or verify API response shapes.
- **Fix:** Create a complete, standardized Postman Collection (v2.1) and Environment file with automated test scripts covering all endpoints, positive/negative assertions, dynamic environment variable extraction (`locker_id`, `member_id`), and audit sequence ordering assertions.
- **Verification:** Execute the Postman collection via automated test runner or Newman, confirming 100% pass rate.

---

### Issue ISS-06: Missing Project Documentation (`README.md`)
- **Severity:** High
- **Module:** Documentation
- **File:** `README.md`
- **Problem:** The repository lacks a `README.md` file.
- **Root Cause:** Aditya's assigned documentation was not merged.
- **Impact:** No documentation on project architecture, setup instructions, endpoints, status codes, audit rules, or team member ownership.
- **Fix:** Create a comprehensive `README.md` adhering to assignment requirements: overview, tech stack, installation, database schema, endpoint tables, status codes, validation rules, transactional audit explanations, Postman execution guide, and team roster.
- **Verification:** Inspect markdown rendering and verify all links and installation steps work accurately.

---

### Issue ISS-07: Missing Contribution Documents for Database and Postman
- **Severity:** Medium
- **Module:** Documentation / Evidence
- **File:** `docs/contributions/akshay.md`, `docs/contributions/aditya.md`
- **Problem:** Only `aravind.md`, `manvith.md`, and `navanesh.md` exist in `docs/contributions/`.
- **Root Cause:** Akshay's contribution doc remains unmerged on `feature/akshay-database`, and Aditya's contribution doc was not created.
- **Impact:** Incomplete student evidence files for grading.
- **Fix:** Integrate `docs/contributions/akshay.md` from Akshay's branch and author `docs/contributions/aditya.md` documenting Postman and README deliverables.
- **Verification:** Verify all 5 member contribution files exist in `docs/contributions/`.

---

### Issue ISS-08: Empty Floor Query Parameter Handling
- **Severity:** Low
- **Module:** Controllers / Lockers
- **File:** `src/controllers/lockers.controller.js` (Lines 35–44)
- **Problem:** When a client passes `?floor=` (empty or whitespace string), `lockers.controller.js` checks `if (floor !== undefined && floor.trim() !== "")`. If empty, it falls back to `SELECT * FROM lockers`, returning all lockers rather than an empty set or a validated floor response.
- **Root Cause:** Discrepancy between controller fallback and `lockerSearch.js` design (which returns `[]` when `trimmedFloor.length === 0`).
- **Impact:** Inconsistent behavior when callers filter by an empty floor parameter.
- **Fix:** Cleanly delegate all `?floor` query requests directly to `lockerSearch.getLockers(floor)`.
- **Verification:** Test `GET /api/lockers?floor=` and verify predictable return behavior.

---

## 3. Summary of Files to Modify and Create

| File | Action | Purpose |
|------|--------|---------|
| `src/db/database.js` | Create | Shared `better-sqlite3` instance with foreign keys enabled |
| `src/db/init.js` | Create | Idempotent table, index, and constraint initializer |
| `src/services/lockerSearch.js` | Fix | Correct argument order and floor search logic in `searchByFloor` |
| `src/controllers/allotments.controller.js` | Fix | Clean shared db import and robust error propagation |
| `src/controllers/lockers.controller.js` | Fix | Clean floor search delegation |
| `src/app.js` | Fix | Explicit, direct route mounting |
| `postman/FitNest_Gym.postman_collection.json` | Create | Postman collection v2.1 with tests for all endpoints |
| `postman/FitNest_Gym.postman_environment.json` | Create | Postman environment with base URL and dynamic variables |
| `README.md` | Create | Comprehensive project documentation |
| `docs/contributions/akshay.md` | Create | Akshay's database contribution document |
| `docs/contributions/aditya.md` | Create | Aditya's Postman & documentation contribution document |
| `docs/INTEGRATION_AUDIT_REPORT.md` | Create | This audit report |
