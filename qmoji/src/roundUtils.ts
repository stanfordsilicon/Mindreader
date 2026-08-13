export function canStartNextRound(roundCount: number, maxRounds: number, hasSubmitted: boolean) {
  if (hasSubmitted) {
    return false;
  }

  return roundCount < maxRounds;
}
