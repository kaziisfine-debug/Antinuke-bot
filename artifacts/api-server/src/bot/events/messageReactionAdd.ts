import { MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js";
import { handleReactionAdd } from "../systems/reactionroles.js";
import { logger } from "../../lib/logger.js";

export async function onMessageReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
  try {
    await handleReactionAdd(reaction, user);
  } catch (err) {
    logger.error({ err }, "messageReactionAdd error");
  }
}
