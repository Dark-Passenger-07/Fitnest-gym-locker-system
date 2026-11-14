"use strict";

/**
 * lockers.routes.js
 * Manvith – Locker CRUD routes
 *
 * Mounts under /api/lockers (registered in app.js by Aravind).
 *
 * validateLocker middleware is Nevanesh's export from
 * src/middleware/lockerValidation.js.  It is applied to POST and PUT
 * to enforce non-empty name and floor before the controller runs.
 */

const { Router } = require("express");
const router = Router();

const {
  getAllLockers,
  getLockerById,
  createLocker,
  updateLocker,
  deleteLocker,
} = require("../controllers/lockers.controller");

// Nevanesh's validation middleware – agreed export name: validateLocker
const { validateLocker } = require("../middleware/lockerValidation");

// GET /api/lockers         – list all; ?floor=<value> filters by floor
// GET /api/lockers/:id     – get one locker
// POST /api/lockers        – create locker (validation middleware applied)
// PUT /api/lockers/:id     – update locker (validation middleware applied)
// DELETE /api/lockers/:id  – delete locker

router.get("/", getAllLockers);
router.get("/:id", getLockerById);
router.post("/", validateLocker, createLocker);
router.put("/:id", validateLocker, updateLocker);
router.delete("/:id", deleteLocker);

module.exports = router;
