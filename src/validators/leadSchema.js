const { z } = require('zod');
const { VALID_STATUSES } = require('../utils/statusMachine');

const createLeadSchema = z.object({
  name: z.string({ required_error: 'name is required' }).trim().min(1, 'name is required'),
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address'),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
});

const updateLeadSchema = z.object({
  name: z.string().trim().min(1, 'name must not be empty').optional(),
  email: z.string().email('email must be a valid email address').optional(),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
});

const updateStatusSchema = z.object({
  status: z
    .string({ required_error: 'status is required' })
    .transform((s) => s.toUpperCase())
    .pipe(
      z.enum(VALID_STATUSES, {
        errorMap: () => ({
          message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
        }),
      })
    ),
});

// Top-level array guard for bulk endpoints — per-item validated individually in controller
const arraySchema = z
  .array(z.unknown())
  .min(1, 'Request body must be a non-empty array');

const bulkUpdateItemSchema = z.object({
  id: z.string({ required_error: 'id is required' }).min(1, 'id is required'),
  name: z.string().trim().min(1, 'name must not be empty').optional(),
  email: z.string().email('email must be a valid email address').optional(),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
});

const firstZodError = (err) => {
  const issues = err?.issues ?? err?.errors ?? [];
  const issue = issues[0];
  if (!issue) return 'Validation error';
  // Zod v4 dropped required_error and the `received` field from issues.
  // Detect missing fields by checking the message text instead.
  if (issue.code === 'invalid_type' && issue.message?.includes('undefined')) {
    const field = issue.path[0] ?? 'field';
    return `${field} is required`;
  }
  return issue.message ?? 'Validation error';
};

module.exports = {
  createLeadSchema,
  updateLeadSchema,
  updateStatusSchema,
  arraySchema,
  bulkUpdateItemSchema,
  firstZodError,
};
