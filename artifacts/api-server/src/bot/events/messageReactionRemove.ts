import { MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js";
import { handleReactionRemove } from "../systems/reactionroles.js";
import { logger } from "../../lib/logger.js";

export async function onMessageReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
  try {
    await handleReactionRemove(reaction, user);
  } catch (err) {
    logger.error({ err }, "messageReactionRemove error");
  }
}
