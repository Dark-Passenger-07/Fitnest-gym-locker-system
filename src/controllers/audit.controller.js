"use strict";

/**
 * audit.controller.js
 * Manvith – Audit endpoint controller
 *
 * GET /api/audit – return the latest 10 locker audit records, newest first.
 */

const auditService = require("../services/lockerAudit.service");

async function getAuditLog(req, res, next) {
  try {
    const rows = auditService.getLatestAudit();
    return res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditLog };
