import { ThreadChannel } from "discord.js";
import { logThreadCreate, logThreadDelete } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onThreadCreate(thread: ThreadChannel): Promise<void> {
  try {
    await logThreadCreate(thread);
  } catch (err) {
    logger.error({ err }, "threadCreate error");
  }
}

export async function onThreadDelete(thread: ThreadChannel): Promise<void> {
  try {
    await logThreadDelete(thread);
  } catch (err) {
    logger.error({ err }, "threadDelete error");
  }
}
