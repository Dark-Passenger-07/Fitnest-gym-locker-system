"use strict";

/**
 * audit.routes.js
 * Manvith – Audit routes
 *
 * Mounts under /api/audit (registered in app.js by Aravind).
 */

const { Router } = require("express");
const router = Router();

const { getAuditLog } = require("../controllers/audit.controller");

// GET /api/audit – latest 10 locker audit rows, newest first
router.get("/", getAuditLog);

module.exports = router;
