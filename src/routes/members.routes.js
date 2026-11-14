"use strict";

/**
 * members.routes.js
 * Aravind – Members router
 *
 * Mounts under /api/members in app.js
 */

const { Router } = require("express");
const router = Router();

const {
  getAllMembers,
  getMemberById,
  createMember,
} = require("../controllers/members.controller");

// GET  /api/members     - List all members
// GET  /api/members/:id - Get one member by ID
// POST /api/members     - Create member
router.get("/", getAllMembers);
router.get("/:id", getMemberById);
router.post("/", createMember);

module.exports = router;
