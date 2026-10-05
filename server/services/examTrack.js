const COMPETITIVE_BRANCH_CODES = new Set(['SSC', 'RAILWAYS', 'BANKING']);

function isCompetitiveBranch(code) {
  return COMPETITIVE_BRANCH_CODES.has(code);
}

module.exports = { isCompetitiveBranch };
