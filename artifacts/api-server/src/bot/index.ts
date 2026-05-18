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
import { onChannelUpdate } from "./events/channelUpdate.js";
import { onRoleCreate } from "./events/roleCreate.js";
import { onRoleDelete } from "./events/roleDelete.js";
import { onRoleUpdate } from "./events/roleUpdate.js";
import { onGuildUpdate } from "./events/guildUpdate.js";
import { onEmojiCreate } from "./events/emojiCreate.js";
import { onEmojiDelete } from "./events/emojiDelete.js";
import { onStickerCreate, onStickerDelete } from "./events/stickerUpdate.js";
import { onWebhooksUpdate } from "./events/webhookUpdate.js";
import { onVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { onInviteCreate, onInviteDelete } from "./events/inviteCreate.js";
import { onThreadCreate, onThreadDelete } from "./events/threadCreate.js";
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
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.GuildWebhooks,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.GuildMember,
      Partials.User,
      Partials.ThreadMember,
    ],
  });

  client.once(Events.ClientReady, () => onReady(client));
  client.on(Events.GuildCreate, onGuildCreate);
  client.on(Events.GuildUpdate, onGuildUpdate);
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
  client.on(Events.ChannelUpdate, onChannelUpdate as any);
  client.on(Events.GuildRoleCreate, onRoleCreate);
  client.on(Events.GuildRoleDelete, onRoleDelete);
  client.on(Events.GuildRoleUpdate, onRoleUpdate);
  client.on(Events.GuildEmojiCreate, onEmojiCreate);
  client.on(Events.GuildEmojiDelete, onEmojiDelete);
  client.on(Events.GuildStickerCreate, onStickerCreate);
  client.on(Events.GuildStickerDelete, onStickerDelete);
  client.on(Events.WebhooksUpdate, onWebhooksUpdate as any);
  client.on(Events.VoiceStateUpdate, onVoiceStateUpdate);
  client.on(Events.InviteCreate, onInviteCreate);
  client.on(Events.InviteDelete, onInviteDelete);
  client.on(Events.ThreadCreate, onThreadCreate);
  client.on(Events.ThreadDelete, onThreadDelete);
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
