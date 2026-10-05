export const competitiveBranchCodes = ['SSC', 'RAILWAYS', 'BANKING'];

export function isCompetitiveBranch(code) {
  return competitiveBranchCodes.includes(code);
}
