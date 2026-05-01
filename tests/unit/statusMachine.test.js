const {
  VALID_STATUSES,
  TRANSITIONS,
  isValidTransition,
  isTerminal,
} = require('../../src/utils/statusMachine');

describe('statusMachine — VALID_STATUSES', () => {
  test('contains exactly the five expected statuses', () => {
    expect(VALID_STATUSES).toEqual(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']);
  });
});

describe('statusMachine — isValidTransition', () => {
  const validPaths = [
    ['NEW', 'CONTACTED'],
    ['NEW', 'LOST'],
    ['CONTACTED', 'QUALIFIED'],
    ['CONTACTED', 'LOST'],
    ['QUALIFIED', 'CONVERTED'],
    ['QUALIFIED', 'LOST'],
  ];

  test.each(validPaths)('%s → %s is a valid transition', (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  const invalidPaths = [
    ['NEW', 'QUALIFIED'],
    ['NEW', 'CONVERTED'],
    ['NEW', 'NEW'],
    ['CONTACTED', 'NEW'],
    ['CONTACTED', 'CONVERTED'],
    ['QUALIFIED', 'NEW'],
    ['QUALIFIED', 'CONTACTED'],
    ['CONVERTED', 'LOST'],
    ['CONVERTED', 'NEW'],
    ['LOST', 'NEW'],
    ['LOST', 'CONTACTED'],
  ];

  test.each(invalidPaths)('%s → %s is an invalid transition', (from, to) => {
    expect(isValidTransition(from, to)).toBe(false);
  });

  test('returns false for an unknown "from" status', () => {
    expect(isValidTransition('UNKNOWN', 'NEW')).toBe(false);
  });
});

describe('statusMachine — isTerminal', () => {
  test('CONVERTED is terminal', () => {
    expect(isTerminal('CONVERTED')).toBe(true);
  });

  test('LOST is terminal', () => {
    expect(isTerminal('LOST')).toBe(true);
  });

  test.each(['NEW', 'CONTACTED', 'QUALIFIED'])('%s is not terminal', (status) => {
    expect(isTerminal(status)).toBe(false);
  });
});

describe('statusMachine — TRANSITIONS map completeness', () => {
  test('every valid status has an entry in TRANSITIONS', () => {
    for (const status of VALID_STATUSES) {
      expect(TRANSITIONS).toHaveProperty(status);
    }
  });

  test('terminal statuses have empty transition arrays', () => {
    expect(TRANSITIONS.CONVERTED).toEqual([]);
    expect(TRANSITIONS.LOST).toEqual([]);
  });
});
