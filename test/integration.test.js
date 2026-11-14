"use strict";

const http = require("http");
const app = require("../src/app");
const db = require("../src/db/database");
const { initDatabase } = require("../src/db/init");

// Ensure schema is fully initialized
initDatabase();

// Spin up test server on an ephemeral port
const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`\n==========================================================`);
  console.log(`FitNest Gym System – Full Integration Test Suite`);
  console.log(`Ephemeral Server running at: ${baseUrl}`);
  console.log(`==========================================================\n`);

  let passed = 0;
  let failed = 0;

  async function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const reqHeaders = { ...headers };
      let bodyData = null;

      if (body !== null && typeof body === "object") {
        reqHeaders["Content-Type"] = "application/json";
        bodyData = JSON.stringify(body);
      } else if (typeof body === "string") {
        bodyData = body;
      }

      if (bodyData) {
        reqHeaders["Content-Length"] = Buffer.byteLength(bodyData);
      }

      const req = http.request(
        url,
        {
          method,
          headers: reqHeaders,
        },
        (res) => {
          let rawData = "";
          res.on("data", (chunk) => (rawData += chunk));
          res.on("end", () => {
            let json = null;
            try {
              json = JSON.parse(rawData);
            } catch (e) {
              json = rawData;
            }
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json,
              raw: rawData,
            });
          });
        }
      );

      req.on("error", reject);
      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    });
  }

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -----------------------------------------------------------------------
    // SECTION 1: MEMBERS APIS
    // -----------------------------------------------------------------------
    console.log("--- 1. Testing Members APIs ---");

    const getMembersInit = await request("GET", "/api/members");
    assert(getMembersInit.status === 200, "GET /api/members returns 200");
    assert(Array.isArray(getMembersInit.body), "GET /api/members returns an array");

    // Create member with email
    const createMember1 = await request("POST", "/api/members", {
      name: "   Carlos Santana   ",
      email: "carlos.santana@fitnest.com",
    });
    assert(createMember1.status === 201, "POST /api/members returns 201 Created");
    assert(createMember1.body.name === "Carlos Santana", "Member name trimmed correctly");
    assert(createMember1.body.email === "carlos.santana@fitnest.com", "Member email stored correctly");
    const member1Id = createMember1.body.id;

    // Create member without email
    const createMember2 = await request("POST", "/api/members", {
      name: "Maria Sharapova",
    });
    assert(createMember2.status === 201, "POST /api/members without email returns 201");
    assert(createMember2.body.email === null, "Omitted email stores as null");
    const member2Id = createMember2.body.id;

    // Get single member
    const getMember1 = await request("GET", `/api/members/${member1Id}`);
    assert(getMember1.status === 200, `GET /api/members/${member1Id} returns 200`);
    assert(getMember1.body.id === member1Id, "Returned member matches requested ID");

    // Absent member
    const getAbsentMember = await request("GET", "/api/members/999999");
    assert(getAbsentMember.status === 404, "GET /api/members/999999 returns 404");
    assert(getAbsentMember.body.error && getAbsentMember.body.error.includes("not found"), "404 returns clean error message");

    // Malformed ID
    const getMalformedMember = await request("GET", "/api/members/abc");
    assert(getMalformedMember.status === 400, "GET /api/members/abc returns 400");
    assert(getMalformedMember.body.error.includes("positive integer"), "Malformed ID error mentions positive integer");

    // Validation: Empty name
    const createEmptyName = await request("POST", "/api/members", { name: "   " });
    assert(createEmptyName.status === 400, "POST /api/members with empty trimmed name returns 400");

    // Validation: Non-string name
    const createNumericName = await request("POST", "/api/members", { name: 12345 });
    assert(createNumericName.status === 400, "POST /api/members with non-string name returns 400");

    // Conflict: Duplicate email
    const createDuplicateEmail = await request("POST", "/api/members", {
      name: "Imposter Carlos",
      email: "carlos.santana@fitnest.com",
    });
    assert(createDuplicateEmail.status === 409, "POST /api/members with duplicate email returns 409 Conflict");
    assert(createDuplicateEmail.body.error.includes("already exists"), "409 message explains duplicate email");

    // -----------------------------------------------------------------------
    // SECTION 2: LOCKERS APIS & VALIDATION
    // -----------------------------------------------------------------------
    console.log("\n--- 2. Testing Lockers CRUD & Validation ---");

    const getLockersInit = await request("GET", "/api/lockers");
    assert(getLockersInit.status === 200, "GET /api/lockers returns 200");
    assert(Array.isArray(getLockersInit.body), "GET /api/lockers returns an array");

    // Create valid locker
    const createLocker1 = await request("POST", "/api/lockers", {
      name: "  Locker G-101  ",
      floor: "  Ground  ",
    });
    assert(createLocker1.status === 201, "POST /api/lockers returns 201 Created");
    assert(createLocker1.body.name === "Locker G-101", "Locker name trimmed by validation middleware");
    assert(createLocker1.body.floor === "Ground", "Locker floor trimmed by validation middleware");
    assert(createLocker1.body.status === "AVAILABLE", "Default status is AVAILABLE");
    const locker1Id = createLocker1.body.id;

    // Get single locker
    const getLocker1 = await request("GET", `/api/lockers/${locker1Id}`);
    assert(getLocker1.status === 200, `GET /api/lockers/${locker1Id} returns 200`);
    assert(getLocker1.body.id === locker1Id, "Locker ID matches requested ID");

    // Update locker
    const updateLocker1 = await request("PUT", `/api/lockers/${locker1Id}`, {
      name: "Locker G-101-Premium",
      floor: "Ground",
    });
    assert(updateLocker1.status === 200, `PUT /api/lockers/${locker1Id} returns 200`);
    assert(updateLocker1.body.name === "Locker G-101-Premium", "Locker updated successfully");

    // Validation: Missing name
    const createMissingName = await request("POST", "/api/lockers", { floor: "Ground" });
    assert(createMissingName.status === 400, "POST /api/lockers with missing name returns 400");

    // Validation: Missing floor
    const createMissingFloor = await request("POST", "/api/lockers", { name: "Locker G-102" });
    assert(createMissingFloor.status === 400, "POST /api/lockers with missing floor returns 400");

    // Validation: Empty whitespace floor
    const createEmptyFloor = await request("POST", "/api/lockers", { name: "Locker G-103", floor: "   " });
    assert(createEmptyFloor.status === 400, "POST /api/lockers with whitespace floor returns 400");

    // Update absent locker
    const updateAbsentLocker = await request("PUT", "/api/lockers/999999", { name: "Ghost", floor: "Roof" });
    assert(updateAbsentLocker.status === 404, "PUT /api/lockers/999999 returns 404 Not Found");

    // -----------------------------------------------------------------------
    // SECTION 3: FLOOR SEARCH SERVICE
    // -----------------------------------------------------------------------
    console.log("\n--- 3. Testing Floor Search Service ---");

    // Create lockers on different floors
    await request("POST", "/api/lockers", { name: "Locker F-201", floor: "First" });
    await request("POST", "/api/lockers", { name: "Locker F-202", floor: "First" });
    await request("POST", "/api/lockers", { name: "Locker S-301", floor: "Second" });

    // Filter by Ground floor
    const searchGround = await request("GET", "/api/lockers?floor=Ground");
    assert(searchGround.status === 200, "GET /api/lockers?floor=Ground returns 200");
    assert(searchGround.body.length >= 1, "Returns at least 1 locker on Ground");
    const allGround = searchGround.body.every((l) => l.floor === "Ground");
    assert(allGround, "All returned lockers strictly have floor === 'Ground'");

    // Filter by First floor
    const searchFirst = await request("GET", "/api/lockers?floor=First");
    assert(searchFirst.status === 200, "GET /api/lockers?floor=First returns 200");
    assert(searchFirst.body.length >= 2, "Returns at least 2 lockers on First floor");
    const allFirst = searchFirst.body.every((l) => l.floor === "First");
    assert(allFirst, "All returned lockers strictly have floor === 'First'");

    // Filter by non-existent floor
    const searchBasement = await request("GET", "/api/lockers?floor=Basement-Negative");
    assert(searchBasement.status === 200, "GET /api/lockers?floor=Basement-Negative returns 200");
    assert(Array.isArray(searchBasement.body) && searchBasement.body.length === 0, "Non-existent floor returns empty array []");

    // -----------------------------------------------------------------------
    // SECTION 4: ALLOTMENTS JOIN & RELATIONAL CONSTRAINTS
    // -----------------------------------------------------------------------
    console.log("\n--- 4. Testing Allotments JOIN & Relational Integrity ---");

    // Insert an allotment directly into DB to test JOIN and constraints
    const insertAllotmentStmt = db.prepare(
      `INSERT INTO allotments (member_id, locker_id, allotted_at) VALUES (?, ?, CURRENT_TIMESTAMP)`
    );
    const allotmentInfo = insertAllotmentStmt.run(member1Id, locker1Id);
    const allotmentId = allotmentInfo.lastInsertRowid;

    // Test GET /api/allotments (3-table JOIN)
    const getAllotments = await request("GET", "/api/allotments");
    assert(getAllotments.status === 200, "GET /api/allotments returns 200");
    assert(getAllotments.body.length >= 1, "Returns joined allotments");

    const matchedAllotment = getAllotments.body.find((a) => a.id === Number(allotmentId));
    assert(matchedAllotment !== undefined, "Found created allotment in join response");
    assert(matchedAllotment.member_id === member1Id, "allotment.member_id matches");
    assert(matchedAllotment.member_name === "Carlos Santana", "allotment.member_name joined from members table");
    assert(matchedAllotment.locker_id === locker1Id, "allotment.locker_id matches");
    assert(matchedAllotment.locker_name === "Locker G-101-Premium", "allotment.locker_name joined from lockers table");
    assert(matchedAllotment.floor === "Ground", "allotment.floor joined from lockers table");
    assert(matchedAllotment.allotted_at !== null, "allotment.allotted_at is present");
    assert(matchedAllotment.returned_at === null, "allotment.returned_at is null for active allotment");

    // Relational Constraint Test: Attempt deleting referenced locker (must fail with 409)
    const deleteReferencedLocker = await request("DELETE", `/api/lockers/${locker1Id}`);
    assert(deleteReferencedLocker.status === 409, "DELETE /api/lockers/:id with active allotment history returns 409 Conflict");
    assert(deleteReferencedLocker.body.error.includes("referenced"), "409 message explains referenced allotment history");

    // Relational Constraint Test: Partial unique index on active locker (at most 1 active allotment per locker)
    let duplicateLockerError = false;
    try {
      db.prepare(`INSERT INTO allotments (member_id, locker_id) VALUES (?, ?)`).run(member2Id, locker1Id);
    } catch (err) {
      duplicateLockerError = err.message.includes("UNIQUE constraint failed");
    }
    assert(duplicateLockerError, "Partial unique index rejects duplicate active allotment for same locker");

    // Relational Constraint Test: Partial unique index on active member (at most 1 active allotment per member)
    let duplicateMemberError = false;
    try {
      // create another locker
      const l2 = db.prepare(`INSERT INTO lockers (name, floor) VALUES ('Locker-Temp', 'Ground')`).run();
      db.prepare(`INSERT INTO allotments (member_id, locker_id) VALUES (?, ?)`).run(member1Id, l2.lastInsertRowid);
    } catch (err) {
      duplicateMemberError = err.message.includes("UNIQUE constraint failed");
    }
    assert(duplicateMemberError, "Partial unique index rejects duplicate active allotment for same member");

    // Return the allotment to verify locker deletion can succeed after closure
    db.prepare(`UPDATE allotments SET returned_at = CURRENT_TIMESTAMP WHERE id = ?`).run(allotmentId);

    // -----------------------------------------------------------------------
    // SECTION 5: MANDATORY AUDIT TEST SEQUENCE (ASSIGNMENT TWIST)
    // -----------------------------------------------------------------------
    console.log("\n--- 5. Testing Mandatory Audit Sequence ---");

    // TEST 1: Create a locker
    const auditTestLocker = await request("POST", "/api/lockers", {
      name: "Audit-Target-Locker-100",
      floor: "Third",
    });
    assert(auditTestLocker.status === 201, "TEST 1: Add locker returns HTTP 201");
    const targetLockerId = auditTestLocker.body.id;

    // TEST 2: Update the same locker
    const auditUpdateLocker = await request("PUT", `/api/lockers/${targetLockerId}`, {
      name: "Audit-Target-Locker-100-Renovated",
      floor: "Third",
    });
    assert(auditUpdateLocker.status === 200, "TEST 2: Update same locker returns HTTP 200");

    // TEST 3: GET /api/audit and verify ordering (UPDATE then CREATE)
    const getAudit = await request("GET", "/api/audit");
    assert(getAudit.status === 200, "TEST 3: GET /api/audit returns HTTP 200");
    assert(Array.isArray(getAudit.body), "Audit endpoint returns an array");
    assert(getAudit.body.length <= 10, "Audit endpoint returns maximum 10 rows");

    // Filter audit entries for our target locker
    const targetLogs = getAudit.body.filter((r) => r.locker_id === targetLockerId);
    assert(targetLogs.length >= 2, "Audit log contains at least 2 entries for test locker");
    assert(targetLogs[0].action === "UPDATE", "Newest entry for locker is 'UPDATE'");
    assert(targetLogs[1].action === "CREATE", "Preceding entry for locker is 'CREATE'");
    assert(targetLogs[0].locker_id === targetLockerId && targetLogs[1].locker_id === targetLockerId, "Both audit entries refer to the same locker ID");

    // TEST 4: Delete locker and verify audit entry survives
    const deleteAuditLocker = await request("DELETE", `/api/lockers/${targetLockerId}`);
    assert(deleteAuditLocker.status === 200, "TEST 4: Delete unreferenced locker returns HTTP 200");

    const getAuditAfterDelete = await request("GET", "/api/audit");
    const latestDeletedLog = getAuditAfterDelete.body.find((r) => r.locker_id === targetLockerId);
    assert(latestDeletedLog !== undefined, "Audit records for deleted locker survive locker deletion");
    assert(latestDeletedLog.action === "DELETE", "Latest survived audit record has action 'DELETE'");

    // -----------------------------------------------------------------------
    // SECTION 6: COMMON MIDDLEWARE (404 & MALFORMED JSON)
    // -----------------------------------------------------------------------
    console.log("\n--- 6. Testing Common Middleware ---");

    const unknownRoute = await request("GET", "/api/does-not-exist");
    assert(unknownRoute.status === 404, "Unknown route returns 404");
    assert(unknownRoute.body.error && unknownRoute.body.error.includes("Route not found"), "404 handler returns clean JSON error");

    const malformedJson = await request("POST", "/api/members", "{ bad json", {
      "Content-Type": "application/json",
    });
    assert(malformedJson.status === 400, "Malformed JSON request body returns 400 Bad Request");
    assert(malformedJson.body.error && malformedJson.body.error.includes("JSON"), "400 message clearly explains malformed JSON");

    // -----------------------------------------------------------------------
    // FINAL SUMMARY
    // -----------------------------------------------------------------------
    console.log(`\n==========================================================`);
    console.log(`INTEGRATION TEST SUMMARY: ${passed} passed, ${failed} failed.`);
    console.log(`==========================================================\n`);

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test execution failed unexpectedly:", err);
    server.close();
    process.exit(1);
  }
});
