import { Sticker, AuditLogEvent } from "discord.js";
import { checkAction, getAuditLogUser } from "../systems/antinuke.js";
import { logStickerCreate, logStickerDelete } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onStickerCreate(sticker: Sticker): Promise<void> {
  const guild = sticker.guild;
  if (!guild) return;
  try {
    await logStickerCreate(sticker);

    const executorId = await getAuditLogUser(guild, AuditLogEvent.StickerCreate);
    if (!executorId || executorId === guild.client.user?.id) return;
    await checkAction(guild, executorId, "stickerCreate", sticker.name);
  } catch (err) {
    logger.error({ err }, "stickerCreate error");
  }
}

export async function onStickerDelete(sticker: Sticker): Promise<void> {
  const guild = sticker.guild;
  if (!guild) return;
  try {
    await logStickerDelete(sticker);

    const executorId = await getAuditLogUser(guild, AuditLogEvent.StickerDelete);
    if (!executorId || executorId === guild.client.user?.id) return;
    await checkAction(guild, executorId, "stickerDelete", sticker.name);
  } catch (err) {
    logger.error({ err }, "stickerDelete error");
  }
}
