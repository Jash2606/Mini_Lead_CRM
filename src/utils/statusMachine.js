const VALID_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

const TRANSITIONS = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['CONVERTED', 'LOST'],
  CONVERTED: [],
  LOST: [],
};

const isValidTransition = (from, to) => {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
};

const isTerminal = (status) => status === 'CONVERTED' || status === 'LOST';

module.exports = { VALID_STATUSES, TRANSITIONS, isValidTransition, isTerminal };
