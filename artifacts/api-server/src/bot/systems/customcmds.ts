import { Message, EmbedBuilder, TextChannel, NewsChannel, ThreadChannel } from "discord.js";
import { getCustomCommand } from "../database.js";
import { BOT_PREFIX, COLORS } from "../config.js";

function isSendable(ch: unknown): ch is TextChannel | NewsChannel | ThreadChannel {
  return !!ch && typeof (ch as { send?: unknown }).send === "function";
}

export async function handleCustomCommand(message: Message, trigger: string): Promise<boolean> {
  if (!message.guild) return false;

  const cmd = await getCustomCommand(message.guild.id, trigger.toLowerCase());
  if (!cmd) return false;

  const response = cmd.response
    .replace(/{user}/g, `<@${message.author.id}>`)
    .replace(/{username}/g, message.author.username)
    .replace(/{server}/g, message.guild.name);

  if (!isSendable(message.channel)) return true;

  if (response.startsWith("embed:")) {
    const text = response.slice(6);
    await message.channel.send({
      embeds: [new EmbedBuilder().setColor(COLORS.info).setDescription(text).setTimestamp()],
    });
  } else {
    await message.channel.send(response);
  }

  return true;
}
