export const UNIVERSAL_OWNER_ID = "806854021431427102";
export const BOT_PREFIX = "!";
export const UNBYPSSABLE_ROLE_NAME = "⚡ Protected";

export const XP_PER_MESSAGE = { min: 15, max: 25 };
export const XP_COOLDOWN_SECONDS = 60;

export const ECONOMY_DAILY_AMOUNT = 500;
export const ECONOMY_WORK_MIN = 100;
export const ECONOMY_WORK_MAX = 500;
export const ECONOMY_WORK_COOLDOWN_HOURS = 1;
export const ECONOMY_DAILY_COOLDOWN_HOURS = 24;
export const ECONOMY_CURRENCY = "💰";

export const COLORS = {
  red: 0xff0000,
  green: 0x00ff00,
  yellow: 0xffff00,
  blue: 0x0099ff,
  purple: 0x9b59b6,
  orange: 0xe67e22,
  white: 0xffffff,
  black: 0x000000,
  antinuke: 0xff4444,
  success: 0x2ecc71,
  warning: 0xf39c12,
  info: 0x3498db,
  giveaway: 0xf1c40f,
};

export function xpForLevel(level: number): number {
  return 100 * (level + 1) * (level + 1);
}

export function levelFromXp(xp: number): number {
  let level = 0;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  return level;
}
