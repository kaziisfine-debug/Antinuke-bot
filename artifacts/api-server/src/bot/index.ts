import {
  Client, GatewayIntentBits, Partials, Events,
} from "discord.js";
import { onReady } from "./events/ready.js";
import { onGuildCreate } from "./events/guildCreate.js";
import { onGuildMemberAdd } from "./events/guildMemberAdd.js";
import { onGuildMemberRemove } from "./events/guildMemberRemove.js";
import { onGuildMemberUpdate } from "./events/guildMemberUpdate.js";
import { onMessageCreate } from "./events/messageCreate.js";
import { onMessageDelete } from "./events/messageDelete.js";
import { onMessageUpdate } from "./events/messageUpdate.js";
import { onGuildBanAdd } from "./events/guildBanAdd.js";
import { onGuildBanRemove } from "./events/guildBanRemove.js";
import { onChannelCreate } from "./events/channelCreate.js";
import { onChannelDelete } from "./events/channelDelete.js";
import { onRoleCreate } from "./events/roleCreate.js";
import { onRoleDelete } from "./events/roleDelete.js";
import { onInteractionCreate } from "./events/interactionCreate.js";
import { onMessageReactionAdd } from "./events/messageReactionAdd.js";
import { onMessageReactionRemove } from "./events/messageReactionRemove.js";
import { logger } from "../lib/logger.js";

export function startBot(): void {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — bot not started");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.GuildMember,
      Partials.User,
    ],
  });

  client.once(Events.ClientReady, () => onReady(client));
  client.on(Events.GuildCreate, onGuildCreate);
  client.on(Events.GuildMemberAdd, onGuildMemberAdd);
  client.on(Events.GuildMemberRemove, onGuildMemberRemove);
  client.on(Events.GuildMemberUpdate, onGuildMemberUpdate);
  client.on(Events.MessageCreate, onMessageCreate);
  client.on(Events.MessageDelete, onMessageDelete);
  client.on(Events.MessageUpdate, onMessageUpdate);
  client.on(Events.GuildBanAdd, onGuildBanAdd);
  client.on(Events.GuildBanRemove, onGuildBanRemove);
  client.on(Events.ChannelCreate, onChannelCreate);
  client.on(Events.ChannelDelete, onChannelDelete);
  client.on(Events.GuildRoleCreate, onRoleCreate);
  client.on(Events.GuildRoleDelete, onRoleDelete);
  client.on(Events.InteractionCreate, onInteractionCreate);
  client.on(Events.MessageReactionAdd, onMessageReactionAdd);
  client.on(Events.MessageReactionRemove, onMessageReactionRemove);

  client.on(Events.Error, (err) => logger.error({ err }, "Discord client error"));
  client.on(Events.Warn, (msg) => logger.warn({ msg }, "Discord client warning"));

  client.login(token).then(() => {
    logger.info("Discord bot logged in");
  }).catch((err) => {
    logger.error({ err }, "Failed to login to Discord — check DISCORD_BOT_TOKEN and ensure privileged intents (Server Members + Message Content) are enabled at discord.com/developers");
  });
}
