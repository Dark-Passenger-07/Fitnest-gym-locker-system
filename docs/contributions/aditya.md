# Aditya – Contribution Document

## Role

**QA Engineer & Technical Writer – Postman Collection, Automated Test Scripts, Environment Configuration, and Project Documentation**

---

## Files Owned

| File | Purpose |
|------|---------|
| `postman/FitNest_Gym.postman_collection.json` | Complete Postman Collection (v2.1) covering all endpoints, positive/negative assertions, and the mandatory 3-step audit sequence |
| `postman/FitNest_Gym.postman_environment.json` | Configurable environment file with `baseUrl`, `test_member_id`, `test_locker_id`, and `last_audit_action` |
| `README.md` | Comprehensive project documentation covering system architecture, installation, endpoint contracts, audit rules, and usage |
| `docs/contributions/aditya.md` | This contribution document |

---

## Deliverables & Implementation

### 1. Postman Test Suite (`postman/FitNest_Gym.postman_collection.json`)
The collection covers all endpoints specified in the assignment contract:
1. **Members**:
   - `GET /api/members` – Verify 200 array response.
   - `POST /api/members` (valid) – Verify 201 response, save `member_id` to environment.
   - `GET /api/members/:id` (valid) – Verify 200 single object.
   - `GET /api/members/:id` (invalid/missing) – Verify 400 for malformed ID, 404 for non-existent.
   - `POST /api/members` (duplicate email) – Verify 409 conflict response.
   - `POST /api/members` (invalid name) – Verify 400 validation response.
2. **Lockers**:
   - `GET /api/lockers` – Verify 200 array response.
   - `GET /api/lockers?floor=Ground` – Verify 200 filtered array.
   - `POST /api/lockers` (valid) – Verify 201 response, save `locker_id` to environment.
   - `PUT /api/lockers/:id` (valid) – Verify 200 updated object.
   - `DELETE /api/lockers/:id` – Verify 200 success response.
   - `GET /api/lockers/:id` (absent) – Verify 404 response.
   - `POST /api/lockers` (empty/invalid) – Verify 400 validation response.
3. **Allotments**:
   - `GET /api/allotments` – Verify 200 joined array (`id`, `member_id`, `member_name`, `locker_id`, `locker_name`, `floor`, `allotted_at`, `returned_at`).
4. **Audit Trail (Mandatory Sequence)**:
   - **Step 1: CREATE locker** (`POST /api/lockers`) → Status 201, extract `created_locker_id`.
   - **Step 2: UPDATE locker** (`PUT /api/lockers/{{created_locker_id}}`) → Status 200.
   - **Step 3: GET audit** (`GET /api/audit`) → Status 200, assert newest row is `UPDATE` and next row is `CREATE`, both matching `created_locker_id`.
   - **Step 4: DELETE locker & verify audit survival** (`DELETE /api/lockers/{{created_locker_id}}`, then `GET /api/audit` confirms `DELETE` action persists).

### 2. Environment Configuration (`postman/FitNest_Gym.postman_environment.json`)
Configures `baseUrl` defaults to `http://localhost:3000` with dynamic runtime slots for extracted entity IDs.

### 3. Project Documentation (`README.md`)
Created comprehensive, structured documentation for developers, examiners, and consumers detailing:
- System overview and technology stack.
- Setup, dependency installation, and server startup.
- Complete API endpoint specification with request/response samples and HTTP status codes.
- Relational schema, partial unique index behavior, and SQLite foreign key constraints.
- Transactional audit log mechanics and survivability guarantees.
- Instructions for importing and running the Postman suite.
- Team member responsibilities and ownership matrix.

---

## Screenshot Checklist

- [ ] Postman app showing imported `FitNest Gym Locker Management System` collection
- [ ] Postman environment active with `baseUrl` set to `http://localhost:3000`
- [ ] Collection Runner execution showing all tests passing (green checkmarks)
- [ ] Test results for Mandatory Audit Sequence: CREATE -> UPDATE -> GET audit verifying row order
- [ ] README.md rendered view on GitHub
