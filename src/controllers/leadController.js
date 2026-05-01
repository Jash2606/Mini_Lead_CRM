const Lead = require('../models/Lead');
const { isValidTransition, isTerminal } = require('../utils/statusMachine');
const cache = require('../config/redis');
const {
  createLeadSchema,
  updateLeadSchema,
  updateStatusSchema,
  arraySchema,
  bulkUpdateItemSchema,
  firstZodError,
} = require('../validators/leadSchema');
const { VALID_STATUSES } = require('../utils/statusMachine');

const createLead = async (req, res, next) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: firstZodError(parsed.error) });
    }

    const { name, email, phone, source } = parsed.data;
    const lead = await Lead.create({
      name,
      email: email.toLowerCase(),
      phone: phone ?? null,
      source: source ?? null,
    });
    return res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
};

const getLeads = async (req, res, next) => {
  try {
    const { status } = req.query;

    if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({
        error: `Invalid status filter. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const leads = await Lead.findAll({
      status: status ? status.toUpperCase() : undefined,
    });
    return res.status(200).json(leads);
  } catch (err) {
    next(err);
  }
};

const getLeadById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cacheKey = `lead:${id}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await cache.set(cacheKey, JSON.stringify(lead));
    return res.status(200).json(lead);
  } catch (err) {
    next(err);
  }
};

const updateLead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: firstZodError(parsed.error) });
    }

    const existing = await Lead.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updated = await Lead.update(id, parsed.data);
    if (!updated) {
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    await cache.del(`lead:${id}`);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteLead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await Lead.remove(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await cache.del(`lead:${id}`);
    return res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: firstZodError(parsed.error) });
    }

    const newStatus = parsed.data.status;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (isTerminal(lead.status)) {
      return res.status(400).json({
        error: `Cannot transition from terminal status ${lead.status}`,
      });
    }

    if (!isValidTransition(lead.status, newStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from ${lead.status} to ${newStatus}`,
      });
    }

    const updated = await Lead.updateStatus(id, newStatus);
    await cache.del(`lead:${id}`);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// Level 2 — Bulk create
const bulkCreateLeads = async (req, res, next) => {
  try {
    const arrayParsed = arraySchema.safeParse(req.body);
    if (!arrayParsed.success) {
      return res.status(422).json({ error: firstZodError(arrayParsed.error) });
    }

    const items = arrayParsed.data;
    const results = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      const itemParsed = createLeadSchema.safeParse(items[i]);
      if (!itemParsed.success) {
        results.push({ index: i, success: false, error: firstZodError(itemParsed.error) });
        failed++;
        continue;
      }

      const { name, email, phone, source } = itemParsed.data;
      try {
        const lead = await Lead.create({
          name,
          email: email.toLowerCase(),
          phone: phone ?? null,
          source: source ?? null,
        });
        results.push({ index: i, success: true, lead });
        successful++;
      } catch (err) {
        const message =
          err.code === '23505'
            ? 'A lead with this email already exists'
            : err.message || 'Failed to create lead';
        results.push({ index: i, success: false, error: message });
        failed++;
      }
    }

    return res.status(207).json({
      total: items.length,
      successful,
      failed,
      results,
    });
  } catch (err) {
    next(err);
  }
};

// Level 2 — Bulk update
const bulkUpdateLeads = async (req, res, next) => {
  try {
    const arrayParsed = arraySchema.safeParse(req.body);
    if (!arrayParsed.success) {
      return res.status(422).json({ error: firstZodError(arrayParsed.error) });
    }

    const items = arrayParsed.data;
    const results = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      const itemParsed = bulkUpdateItemSchema.safeParse(items[i]);
      if (!itemParsed.success) {
        results.push({ index: i, success: false, error: firstZodError(itemParsed.error) });
        failed++;
        continue;
      }

      const { id, ...fields } = itemParsed.data;
      try {
        const existing = await Lead.findById(id);
        if (!existing) {
          results.push({ index: i, id, success: false, error: 'Lead not found' });
          failed++;
          continue;
        }

        const updated = await Lead.update(id, fields);
        if (!updated) {
          results.push({ index: i, id, success: false, error: 'No valid fields provided to update' });
          failed++;
          continue;
        }

        await cache.del(`lead:${id}`);
        results.push({ index: i, id, success: true, lead: updated });
        successful++;
      } catch (err) {
        const message =
          err.code === '23505'
            ? 'A lead with this email already exists'
            : err.message || 'Failed to update lead';
        results.push({ index: i, id, success: false, error: message });
        failed++;
      }
    }

    return res.status(207).json({
      total: items.length,
      successful,
      failed,
      results,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  updateStatus,
  bulkCreateLeads,
  bulkUpdateLeads,
};
