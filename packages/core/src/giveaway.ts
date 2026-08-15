export interface EligibleEntry {
  userId: string;
  weight: number;
}

export function selectGiveawayWinners(entries: EligibleEntry[], winnerCount: number, random: () => number = Math.random): string[] {
  if (!Number.isInteger(winnerCount) || winnerCount < 1) throw new RangeError("Winner count must be at least one.");
  const pool = entries.filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0);
  const winners: string[] = [];

  while (pool.length > 0 && winners.length < winnerCount) {
    const totalWeight = pool.reduce((total, entry) => total + entry.weight, 0);
    let point = Math.min(0.999999999999, Math.max(0, random())) * totalWeight;
    let chosenIndex = pool.length - 1;
    for (let index = 0; index < pool.length; index += 1) {
      point -= pool[index].weight;
      if (point < 0) {
        chosenIndex = index;
        break;
      }
    }
    winners.push(pool[chosenIndex].userId);
    pool.splice(chosenIndex, 1);
  }
  return winners;
}
