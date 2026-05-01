const {
  createLeadSchema,
  updateLeadSchema,
  updateStatusSchema,
  arraySchema,
  bulkUpdateItemSchema,
  firstZodError,
} = require('../../src/validators/leadSchema');

// ---------------------------------------------------------------------------
// createLeadSchema
// ---------------------------------------------------------------------------
describe('createLeadSchema', () => {
  test('accepts valid input with all fields', () => {
    const result = createLeadSchema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      phone: '+1234567890',
      source: 'website',
    });
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Alice');
    expect(result.data.email).toBe('alice@example.com');
  });

  test('accepts valid input with only required fields', () => {
    const result = createLeadSchema.safeParse({ name: 'Bob', email: 'bob@example.com' });
    expect(result.success).toBe(true);
  });

  test('fails when name is missing', () => {
    const result = createLeadSchema.safeParse({ email: 'no@example.com' });
    expect(result.success).toBe(false);
    const msg = firstZodError(result.error);
    expect(msg).toMatch(/name/i);
  });

  test('fails when email is missing', () => {
    const result = createLeadSchema.safeParse({ name: 'No Email' });
    expect(result.success).toBe(false);
    const msg = firstZodError(result.error);
    expect(msg).toMatch(/email/i);
  });

  test('fails for invalid email format', () => {
    const result = createLeadSchema.safeParse({ name: 'Bad', email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(firstZodError(result.error)).toMatch(/email/i);
  });

  test('fails when name is an empty string', () => {
    const result = createLeadSchema.safeParse({ name: '   ', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  test('phone and source are optional', () => {
    const result = createLeadSchema.safeParse({ name: 'X', email: 'x@y.com', phone: null, source: null });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateLeadSchema
// ---------------------------------------------------------------------------
describe('updateLeadSchema', () => {
  test('accepts partial update with only name', () => {
    const result = updateLeadSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  test('accepts partial update with only email', () => {
    const result = updateLeadSchema.safeParse({ email: 'new@example.com' });
    expect(result.success).toBe(true);
  });

  test('accepts empty object (no fields — controller handles the 400)', () => {
    const result = updateLeadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test('fails for invalid email on update', () => {
    const result = updateLeadSchema.safeParse({ email: 'not-valid' });
    expect(result.success).toBe(false);
  });

  test('fails when name is empty string', () => {
    const result = updateLeadSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateStatusSchema
// ---------------------------------------------------------------------------
describe('updateStatusSchema', () => {
  const validStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

  test.each(validStatuses)('accepts valid status %s', (status) => {
    const result = updateStatusSchema.safeParse({ status });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe(status);
  });

  test('normalises lowercase input to uppercase', () => {
    const result = updateStatusSchema.safeParse({ status: 'contacted' });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('CONTACTED');
  });

  test('normalises mixed-case input to uppercase', () => {
    const result = updateStatusSchema.safeParse({ status: 'QuAliFiEd' });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('QUALIFIED');
  });

  test('fails for an invalid status value', () => {
    const result = updateStatusSchema.safeParse({ status: 'BOGUS' });
    expect(result.success).toBe(false);
  });

  test('fails when status is missing', () => {
    const result = updateStatusSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(firstZodError(result.error)).toMatch(/status/i);
  });
});

// ---------------------------------------------------------------------------
// arraySchema
// ---------------------------------------------------------------------------
describe('arraySchema', () => {
  test('accepts a non-empty array', () => {
    const result = arraySchema.safeParse([{ name: 'A' }]);
    expect(result.success).toBe(true);
  });

  test('fails for an empty array', () => {
    const result = arraySchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  test('fails for a plain object', () => {
    const result = arraySchema.safeParse({ name: 'Not Array' });
    expect(result.success).toBe(false);
  });

  test('fails for a string', () => {
    const result = arraySchema.safeParse('not an array');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// bulkUpdateItemSchema
// ---------------------------------------------------------------------------
describe('bulkUpdateItemSchema', () => {
  test('accepts valid item with id and fields', () => {
    const result = bulkUpdateItemSchema.safeParse({
      id: 'some-uuid',
      name: 'Updated',
    });
    expect(result.success).toBe(true);
  });

  test('fails when id is missing', () => {
    const result = bulkUpdateItemSchema.safeParse({ name: 'No ID' });
    expect(result.success).toBe(false);
    expect(firstZodError(result.error)).toMatch(/id/i);
  });

  test('fails when id is empty string', () => {
    const result = bulkUpdateItemSchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// firstZodError helper
// ---------------------------------------------------------------------------
describe('firstZodError', () => {
  test('returns "Validation error" when no issues exist', () => {
    expect(firstZodError({ issues: [] })).toBe('Validation error');
  });

  test('returns issue message for a standard error', () => {
    const result = createLeadSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
    const msg = firstZodError(result.error);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
