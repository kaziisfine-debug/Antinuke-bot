import { GuildMember, EmbedBuilder } from "discord.js";
import {
  getOrCreateUserEconomy, updateUserEconomy, getTopEconomy,
} from "../database.js";
import {
  COLORS, ECONOMY_CURRENCY, ECONOMY_DAILY_AMOUNT, ECONOMY_WORK_MIN,
  ECONOMY_WORK_MAX, ECONOMY_WORK_COOLDOWN_HOURS, ECONOMY_DAILY_COOLDOWN_HOURS,
} from "../config.js";

const WORK_RESPONSES = [
  "You worked as a programmer and earned",
  "You delivered packages and earned",
  "You washed cars and earned",
  "You mined crypto and earned",
  "You streamed games and earned",
  "You babysat kids and earned",
  "You fixed computers and earned",
  "You walked dogs and earned",
];

export async function getBalance(guildId: string, userId: string) {
  return getOrCreateUserEconomy(guildId, userId);
}

export async function dailyReward(guildId: string, userId: string): Promise<{ success: boolean; amount?: number; nextAvailable?: Date }> {
  const eco = await getOrCreateUserEconomy(guildId, userId);
  const now = new Date();

  if (eco.lastDaily) {
    const diff = (now.getTime() - eco.lastDaily.getTime()) / (1000 * 60 * 60);
    if (diff < ECONOMY_DAILY_COOLDOWN_HOURS) {
      const nextAvailable = new Date(eco.lastDaily.getTime() + ECONOMY_DAILY_COOLDOWN_HOURS * 60 * 60 * 1000);
      return { success: false, nextAvailable };
    }
  }

  await updateUserEconomy(guildId, userId, {
    wallet: eco.wallet + ECONOMY_DAILY_AMOUNT,
    lastDaily: now,
  });

  return { success: true, amount: ECONOMY_DAILY_AMOUNT };
}

export async function workReward(guildId: string, userId: string): Promise<{ success: boolean; amount?: number; message?: string; nextAvailable?: Date }> {
  const eco = await getOrCreateUserEconomy(guildId, userId);
  const now = new Date();

  if (eco.lastWork) {
    const diff = (now.getTime() - eco.lastWork.getTime()) / (1000 * 60 * 60);
    if (diff < ECONOMY_WORK_COOLDOWN_HOURS) {
      const nextAvailable = new Date(eco.lastWork.getTime() + ECONOMY_WORK_COOLDOWN_HOURS * 60 * 60 * 1000);
      return { success: false, nextAvailable };
    }
  }

  const amount = Math.floor(Math.random() * (ECONOMY_WORK_MAX - ECONOMY_WORK_MIN + 1)) + ECONOMY_WORK_MIN;
  const message = WORK_RESPONSES[Math.floor(Math.random() * WORK_RESPONSES.length)]!;

  await updateUserEconomy(guildId, userId, {
    wallet: eco.wallet + amount,
    lastWork: now,
  });

  return { success: true, amount, message };
}

export async function transferBalance(guildId: string, fromId: string, toId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  const from = await getOrCreateUserEconomy(guildId, fromId);
  if (from.wallet < amount) return { success: false, error: "Insufficient wallet balance." };
  if (amount <= 0) return { success: false, error: "Amount must be positive." };

  await updateUserEconomy(guildId, fromId, { wallet: from.wallet - amount });
  const to = await getOrCreateUserEconomy(guildId, toId);
  await updateUserEconomy(guildId, toId, { wallet: to.wallet + amount });

  return { success: true };
}

export async function deposit(guildId: string, userId: string, amount: number | "all"): Promise<{ success: boolean; deposited?: number; error?: string }> {
  const eco = await getOrCreateUserEconomy(guildId, userId);
  const depositAmount = amount === "all" ? eco.wallet : amount;
  if (depositAmount <= 0) return { success: false, error: "Nothing to deposit." };
  if (eco.wallet < depositAmount) return { success: false, error: "Insufficient wallet balance." };

  await updateUserEconomy(guildId, userId, {
    wallet: eco.wallet - depositAmount,
    bank: eco.bank + depositAmount,
  });

  return { success: true, deposited: depositAmount };
}

export async function withdraw(guildId: string, userId: string, amount: number | "all"): Promise<{ success: boolean; withdrawn?: number; error?: string }> {
  const eco = await getOrCreateUserEconomy(guildId, userId);
  const withdrawAmount = amount === "all" ? eco.bank : amount;
  if (withdrawAmount <= 0) return { success: false, error: "Nothing to withdraw." };
  if (eco.bank < withdrawAmount) return { success: false, error: "Insufficient bank balance." };

  await updateUserEconomy(guildId, userId, {
    wallet: eco.wallet + withdrawAmount,
    bank: eco.bank - withdrawAmount,
  });

  return { success: true, withdrawn: withdrawAmount };
}

export async function buildLeaderboard(guildId: string, guildName: string): Promise<EmbedBuilder> {
  const top = await getTopEconomy(guildId, 10);
  const desc = top.length === 0
    ? "No data yet."
    : top.map((u, i) => `**${i + 1}.** <@${u.userId}> — ${ECONOMY_CURRENCY} **${(u.wallet + u.bank).toLocaleString()}**`).join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.yellow)
    .setTitle(`${ECONOMY_CURRENCY} ${guildName} Economy Leaderboard`)
    .setDescription(desc)
    .setTimestamp();
}

export function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
