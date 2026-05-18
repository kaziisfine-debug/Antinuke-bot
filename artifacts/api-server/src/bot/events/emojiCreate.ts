import { GuildEmoji, AuditLogEvent } from "discord.js";
import { checkAction, getAuditLogUser } from "../systems/antinuke.js";
import { logEmojiCreate } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onEmojiCreate(emoji: GuildEmoji): Promise<void> {
  if (!emoji.guild) return;
  try {
    await logEmojiCreate(emoji);

    const executorId = await getAuditLogUser(emoji.guild, AuditLogEvent.EmojiCreate);
    if (!executorId || executorId === emoji.guild.client.user?.id) return;
    await checkAction(emoji.guild, executorId, "emojiCreate", `:${emoji.name}:`);
  } catch (err) {
    logger.error({ err }, "emojiCreate error");
  }
}
