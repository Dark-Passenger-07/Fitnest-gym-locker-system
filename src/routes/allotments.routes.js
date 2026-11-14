"use strict";

/**
 * allotments.routes.js
 * Nevanesh – Allotments Router
 *
 * Mounts under /api/allotments (registered in app.js by Aravind).
 * Exposes GET /api/allotments to return joined allotment, member, and locker records.
 */

const { Router } = require("express");
const router = Router();
const { getAllAllotments } = require("../controllers/allotments.controller");

// GET /api/allotments - Join allotments + members + lockers
router.get("/", getAllAllotments);

module.exports = router;
