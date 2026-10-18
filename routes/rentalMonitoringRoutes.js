// Imported rental history is read-only in production. Live finance APIs own ledger writes.
const router = require('express').Router();
const pool = require('../config/db');
router.use(require('../middleware/authMiddleware').authMiddleware);
router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    return res.set('Allow', 'GET, HEAD').status(405).json({message: 'Imported rental history is read-only.'});
});
router.use(require('../scripts/ux/legacy-rental-monitor-router.cjs')(pool));
module.exports = router;
