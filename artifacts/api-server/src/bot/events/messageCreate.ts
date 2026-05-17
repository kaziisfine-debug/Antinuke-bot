import { Message } from "discord.js";
import { handleMessageXP } from "../systems/leveling.js";
import { handleCustomCommand } from "../systems/customcmds.js";
import { BOT_PREFIX } from "../config.js";
import { logger } from "../../lib/logger.js";

export async function onMessageCreate(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;

  try {
    // XP system
    await handleMessageXP(message);

    // Custom commands / tags (prefix-based)
    if (message.content.startsWith(BOT_PREFIX)) {
      const trigger = message.content.slice(BOT_PREFIX.length).split(" ")[0]?.toLowerCase();
      if (trigger) {
        await handleCustomCommand(message, trigger);
      }
    }
  } catch (err) {
    logger.error({ err, guildId: message.guild?.id }, "messageCreate error");
  }
}
