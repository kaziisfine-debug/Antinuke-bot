import { Guild } from "discord.js";
import { ensureGuild } from "../database.js";
import { captureSnapshot } from "../systems/recovery.js";
import { logger } from "../../lib/logger.js";

export async function onGuildCreate(guild: Guild): Promise<void> {
  logger.info({ guildId: guild.id, name: guild.name }, "Joined new guild");
  await ensureGuild(guild.id);
  await captureSnapshot(guild);
}
