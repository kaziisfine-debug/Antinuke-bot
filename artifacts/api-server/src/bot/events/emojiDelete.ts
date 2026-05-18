import { GuildEmoji, AuditLogEvent } from "discord.js";
import { checkAction, getAuditLogUser } from "../systems/antinuke.js";
import { logEmojiDelete } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onEmojiDelete(emoji: GuildEmoji): Promise<void> {
  if (!emoji.guild) return;
  try {
    await logEmojiDelete(emoji);

    const executorId = await getAuditLogUser(emoji.guild, AuditLogEvent.EmojiDelete);
    if (!executorId || executorId === emoji.guild.client.user?.id) return;
    await checkAction(emoji.guild, executorId, "emojiDelete", `:${emoji.name}:`);
  } catch (err) {
    logger.error({ err }, "emojiDelete error");
  }
}
