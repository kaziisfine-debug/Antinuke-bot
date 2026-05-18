import { Guild, AuditLogEvent } from "discord.js";
import { checkAction, getAuditLogUser } from "../systems/antinuke.js";
import { logServerUpdate } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onGuildUpdate(oldGuild: Guild, newGuild: Guild): Promise<void> {
  try {
    await logServerUpdate(oldGuild, newGuild);

    const executorId = await getAuditLogUser(newGuild, AuditLogEvent.GuildUpdate);
    if (!executorId || executorId === newGuild.client.user?.id) return;
    await checkAction(newGuild, executorId, "serverUpdate", newGuild.name);
  } catch (err) {
    logger.error({ err }, "guildUpdate error");
  }
}
