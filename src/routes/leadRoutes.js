const express = require('express');
const router = express.Router();
const {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  updateStatus,
  bulkCreateLeads,
  bulkUpdateLeads,
} = require('../controllers/leadController');

// Bulk routes must be registered before /:id to avoid param collision
router.post('/bulk', bulkCreateLeads);
router.put('/bulk', bulkUpdateLeads);

router.post('/', createLead);
router.get('/', getLeads);
router.get('/:id', getLeadById);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);
router.patch('/:id/status', updateStatus);

module.exports = router;
