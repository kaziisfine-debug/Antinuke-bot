import { Message, PartialMessage } from "discord.js";
import { logMessageEdit } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
  if (!newMessage.guild || newMessage.author?.bot) return;
  try {
    await logMessageEdit(oldMessage, newMessage);
  } catch (err) {
    logger.error({ err }, "messageUpdate error");
  }
}
