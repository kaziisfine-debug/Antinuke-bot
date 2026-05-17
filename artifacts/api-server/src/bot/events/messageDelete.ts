import { Message, PartialMessage } from "discord.js";
import { logMessageDelete } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild || message.author?.bot) return;
  try {
    await logMessageDelete(message);
  } catch (err) {
    logger.error({ err }, "messageDelete error");
  }
}
