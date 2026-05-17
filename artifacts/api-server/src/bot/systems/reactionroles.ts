import { MessageReaction, User, PartialMessageReaction, PartialUser, GuildMember } from "discord.js";
import { getReactionRoles } from "../database.js";
import { logger } from "../../lib/logger.js";

function normalizeEmoji(emoji: MessageReaction["emoji"]): string {
  return emoji.id ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>` : (emoji.name ?? "");
}

export async function handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (!reaction.message.guild) return;

    const rrs = await getReactionRoles(reaction.message.id);
    if (rrs.length === 0) return;

    const emoji = normalizeEmoji(reaction.emoji);
    const rr = rrs.find(r => r.emoji === emoji || r.emoji === reaction.emoji.name);
    if (!rr) return;

    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null) as GuildMember | null;
    if (!member) return;

    const role = reaction.message.guild.roles.cache.get(rr.roleId);
    if (!role) return;

    if (rr.mode === "remove") {
      await member.roles.remove(role, "Reaction Role Remove").catch(() => {});
    } else {
      await member.roles.add(role, "Reaction Role Add").catch(() => {});
    }
  } catch (err) {
    logger.warn({ err }, "Reaction role add error");
  }
}

export async function handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (!reaction.message.guild) return;

    const rrs = await getReactionRoles(reaction.message.id);
    if (rrs.length === 0) return;

    const emoji = normalizeEmoji(reaction.emoji);
    const rr = rrs.find(r => r.emoji === emoji || r.emoji === reaction.emoji.name);
    if (!rr || rr.mode === "add") return;

    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null) as GuildMember | null;
    if (!member) return;

    const role = reaction.message.guild.roles.cache.get(rr.roleId);
    if (!role) return;

    await member.roles.remove(role, "Reaction Role Remove").catch(() => {});
  } catch (err) {
    logger.warn({ err }, "Reaction role remove error");
  }
}
