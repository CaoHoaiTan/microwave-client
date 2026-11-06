const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function rewardSummary(task, result, user) {
  return {
    task,
    status: result.voided ? 'voided' : 'completed',
    message: result.message ?? null,
    // Use the actual award in the final response, not the task's advertised reward.
    mcoinAwarded: result.voided ? null : number(result.reward),
    xpAwarded: result.voided ? null : number(result.xp),
    balanceMcoin: number(user?.coins),
    totalXp: number(user?.xp),
    level: number(user?.level),
    levelUp: result.levelUp ?? null,
  };
}
export function formatRewardSummary(s) {
  if (s.status === 'voided') return `[${s.task}] Kết quả bị hủy; không xác nhận cộng điểm. ${s.message ?? ''}`;
  const awarded = (n, unit) => n === null ? `${unit}: server không trả số điểm` : `${n >= 0 ? '+' : ''}${n} ${unit}`;
  let text = `[${s.task}] Hoàn thành: ${awarded(s.mcoinAwarded, 'MCOIN')} | ${awarded(s.xpAwarded, 'XP')}`;
  if (s.balanceMcoin !== null) text += ` | Số dư: ${s.balanceMcoin} MCOIN`;
  if (s.totalXp !== null) text += ` | Tổng XP: ${s.totalXp}`;
  if (s.level !== null) text += ` | Level ${s.level}`;
  return text;
}
