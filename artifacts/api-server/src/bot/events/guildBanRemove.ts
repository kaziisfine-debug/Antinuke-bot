import { GuildBan } from "discord.js";
import { logBanRemove } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onGuildBanRemove(ban: GuildBan): Promise<void> {
  try {
    await logBanRemove(ban.guild, ban.user);
  } catch (err) {
    logger.error({ err }, "guildBanRemove error");
  }
}
