import {
  Guild, GuildMember, Message, TextChannel, EmbedBuilder,
  AuditLogEvent, User, Role, GuildChannel, PartialMessage,
  PartialGuildMember, VoiceState, GuildEmoji, Sticker,
  NonThreadGuildBasedChannel, Invite, ThreadChannel, ColorResolvable,
} from "discord.js";
import { getLogConfig } from "../database.js";
import { BRAND } from "../embed.js";

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  black:   0x000000,
  green:   0x57f287,
  red:     0xed4245,
  yellow:  0xfee75c,
  orange:  0xe67e22,
  purple:  0x9b59b6,
  blue:    0x5865f2,
  teal:    0x1abc9c,
} as const;

function logEmbed(color: number, title: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color as ColorResolvable)
    .setTitle(title)
    .setFooter({ text: "Shonargaon Antinuke  ·  Logs", iconURL: BRAND.icon ?? undefined })
    .setTimestamp();
}

async function getLogChannel(guild: Guild): Promise<TextChannel | null> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.logChannelId) return null;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  return (ch instanceof TextChannel ? ch : null) ?? null;
}

async function send(guild: Guild, embed: EmbedBuilder): Promise<void> {
  const ch = await getLogChannel(guild);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

async function getExecutor(guild: Guild, event: AuditLogEvent): Promise<string | null> {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type: event });
    const entry = logs.entries.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return null;
    return entry.executor?.id ?? null;
  } catch {
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MESSAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild || message.author?.bot) return;
  const cfg = await getLogConfig(message.guild.id);
  if (!cfg.messageDelete || !cfg.logChannelId) return;

  await send(message.guild, logEmbed(C.red, "🗑️  Message Deleted")
    .setThumbnail(message.author?.displayAvatarURL() ?? null)
    .addFields(
      { name: "Author",   value: message.author ? `<@${message.author.id}> (\`${message.author.tag}\`)` : "Unknown", inline: true },
      { name: "Channel",  value: `<#${message.channelId}>`, inline: true },
      { name: "Content",  value: message.content?.slice(0, 1000) || "*No text content*" },
    ));
}

export async function logMessageEdit(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  const cfg = await getLogConfig(newMessage.guild.id);
  if (!cfg.messageEdit || !cfg.logChannelId) return;

  await send(newMessage.guild, logEmbed(C.yellow, "✏️  Message Edited")
    .setURL(newMessage.url)
    .setThumbnail(newMessage.author?.displayAvatarURL() ?? null)
    .addFields(
      { name: "Author",  value: newMessage.author ? `<@${newMessage.author.id}>` : "Unknown", inline: true },
      { name: "Channel", value: `<#${newMessage.channelId}>`, inline: true },
      { name: "Before",  value: oldMessage.content?.slice(0, 500) || "*Unknown*" },
      { name: "After",   value: newMessage.content?.slice(0, 500) || "*Empty*" },
    ));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEMBERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logMemberJoin(member: GuildMember): Promise<void> {
  const cfg = await getLogConfig(member.guild.id);
  if (!cfg.memberJoin || !cfg.logChannelId) return;

  const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
  const newAccount = ageDays < 7;

  await send(member.guild, logEmbed(C.green, "📥  Member Joined")
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "User",         value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
      { name: "Account Age",  value: `${ageDays}d ${newAccount ? "⚠️ **New**" : ""}`, inline: true },
      { name: "Member Count", value: `\`${member.guild.memberCount}\``, inline: true },
      { name: "ID",           value: `\`${member.id}\``, inline: true },
    ));
}

export async function logMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  const cfg = await getLogConfig(member.guild.id);
  if (!cfg.logChannelId) return;

  // Check if this was a kick via audit log
  const kickExec = await getExecutor(member.guild, AuditLogEvent.MemberKick);

  if (kickExec && kickExec !== member.guild.client.user?.id) {
    if (!cfg.memberKick) return;
    await send(member.guild, logEmbed(C.orange, "👢  Member Kicked")
      .setThumbnail(member.user?.displayAvatarURL() ?? null)
      .addFields(
        { name: "User",     value: `<@${member.id}> (\`${member.user?.tag ?? "Unknown"}\`)`, inline: true },
        { name: "Kicked By", value: `<@${kickExec}>`, inline: true },
        { name: "ID",       value: `\`${member.id}\``, inline: true },
      ));
  } else {
    if (!cfg.memberLeave) return;
    await send(member.guild, logEmbed(C.orange, "📤  Member Left")
      .setThumbnail(member.user?.displayAvatarURL() ?? null)
      .addFields(
        { name: "User",         value: `<@${member.id}> (\`${member.user?.tag ?? "Unknown"}\`)`, inline: true },
        { name: "Member Count", value: `\`${member.guild.memberCount}\``, inline: true },
        { name: "ID",           value: `\`${member.id}\``, inline: true },
      ));
  }
}

export async function logBanAdd(guild: Guild, user: User): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.memberBan || !cfg.logChannelId) return;

  const executor = await getExecutor(guild, AuditLogEvent.MemberBanAdd);
  let reason = "No reason provided";
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
    const entry = logs.entries.find(e => (e.target as User)?.id === user.id);
    if (entry?.reason) reason = entry.reason;
  } catch {}

  await send(guild, logEmbed(C.red, "🔨  Member Banned")
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: "User",       value: `<@${user.id}> (\`${user.tag}\`)`, inline: true },
      { name: "Banned By",  value: executor ? `<@${executor}>` : "Unknown", inline: true },
      { name: "ID",         value: `\`${user.id}\``, inline: true },
      { name: "Reason",     value: reason },
    ));
}

export async function logBanRemove(guild: Guild, user: User): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.memberUnban || !cfg.logChannelId) return;

  const executor = await getExecutor(guild, AuditLogEvent.MemberBanRemove);

  await send(guild, logEmbed(C.green, "✅  Member Unbanned")
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: "User",        value: `<@${user.id}> (\`${user.tag}\`)`, inline: true },
      { name: "Unbanned By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
      { name: "ID",          value: `\`${user.id}\``, inline: true },
    ));
}

export async function logMemberTimeout(member: GuildMember, until: Date | null): Promise<void> {
  const cfg = await getLogConfig(member.guild.id);
  if (!cfg.memberTimeout || !cfg.logChannelId) return;

  const executor = await getExecutor(member.guild, AuditLogEvent.MemberUpdate);

  if (until) {
    await send(member.guild, logEmbed(C.orange, "⏱️  Member Timed Out")
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: "User",       value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
        { name: "Timed Out By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
        { name: "Expires",    value: `<t:${Math.floor(until.getTime() / 1000)}:R>`, inline: true },
      ));
  } else {
    await send(member.guild, logEmbed(C.green, "✅  Timeout Removed")
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: "User",          value: `<@${member.id}>`, inline: true },
        { name: "Removed By",    value: executor ? `<@${executor}>` : "Unknown", inline: true },
      ));
  }
}

export async function logMemberRoleChange(
  member: GuildMember,
  addedRoles: Role[],
  removedRoles: Role[],
): Promise<void> {
  const cfg = await getLogConfig(member.guild.id);
  if (!cfg.memberRoleChange || !cfg.logChannelId) return;
  if (!addedRoles.length && !removedRoles.length) return;

  const executor = await getExecutor(member.guild, AuditLogEvent.MemberRoleUpdate);

  const e = logEmbed(C.blue, "🏷️  Member Roles Updated")
    .setThumbnail(member.user.displayAvatarURL())
    .addFields({ name: "User", value: `<@${member.id}>`, inline: true });

  if (executor) e.addFields({ name: "Updated By", value: `<@${executor}>`, inline: true });
  if (addedRoles.length)   e.addFields({ name: "➕  Added",   value: addedRoles.map(r   => `<@&${r.id}>`).join(" "), inline: false });
  if (removedRoles.length) e.addFields({ name: "➖  Removed", value: removedRoles.map(r => `<@&${r.id}>`).join(" "), inline: false });

  await send(member.guild, e);
}

export async function logNicknameChange(member: GuildMember, oldNick: string | null, newNick: string | null): Promise<void> {
  const cfg = await getLogConfig(member.guild.id);
  if (!cfg.nicknameChange || !cfg.logChannelId) return;

  await send(member.guild, logEmbed(C.yellow, "📝  Nickname Changed")
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "User",   value: `<@${member.id}>`, inline: true },
      { name: "Before", value: oldNick ?? "`None`", inline: true },
      { name: "After",  value: newNick ?? "`None`",  inline: true },
    ));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VOICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logVoiceState(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (!newState.guild) return;
  const cfg = await getLogConfig(newState.guild.id);
  if (!cfg.logChannelId) return;

  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  const joined  = !oldState.channelId && newState.channelId;
  const left    = oldState.channelId  && !newState.channelId;
  const moved   = oldState.channelId  && newState.channelId && oldState.channelId !== newState.channelId;

  if (joined && cfg.voiceJoin) {
    await send(newState.guild, logEmbed(C.green, "🔊  Joined Voice Channel")
      .addFields(
        { name: "User",    value: `<@${member.id}>`, inline: true },
        { name: "Channel", value: `<#${newState.channelId}>`, inline: true },
      ));
  } else if (left && cfg.voiceLeave) {
    await send(newState.guild, logEmbed(C.orange, "🔇  Left Voice Channel")
      .addFields(
        { name: "User",    value: `<@${member.id}>`, inline: true },
        { name: "Channel", value: `<#${oldState.channelId}>`, inline: true },
      ));
  } else if (moved && cfg.voiceMove) {
    await send(newState.guild, logEmbed(C.purple, "🔀  Moved Voice Channel")
      .addFields(
        { name: "User",  value: `<@${member.id}>`, inline: true },
        { name: "From",  value: `<#${oldState.channelId}>`, inline: true },
        { name: "To",    value: `<#${newState.channelId}>`, inline: true },
      ));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logRoleCreate(guild: Guild, role: Role): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.roleCreate || !cfg.logChannelId) return;

  const executor = await getExecutor(guild, AuditLogEvent.RoleCreate);

  await send(guild, logEmbed(C.green, "✨  Role Created")
    .addFields(
      { name: "Role",       value: `<@&${role.id}> (\`${role.name}\`)`, inline: true },
      { name: "Created By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
      { name: "Color",      value: `\`${role.hexColor}\``, inline: true },
    ));
}

export async function logRoleDelete(guild: Guild, roleName: string, roleId: string): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.roleDelete || !cfg.logChannelId) return;

  const executor = await getExecutor(guild, AuditLogEvent.RoleDelete);

  await send(guild, logEmbed(C.red, "🗑️  Role Deleted")
    .addFields(
      { name: "Role Name",  value: roleName, inline: true },
      { name: "Deleted By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
      { name: "ID",         value: `\`${roleId}\``, inline: true },
    ));
}

export async function logRoleUpdate(oldRole: Role, newRole: Role): Promise<void> {
  const cfg = await getLogConfig(newRole.guild.id);
  if (!cfg.roleUpdate || !cfg.logChannelId) return;

  const executor = await getExecutor(newRole.guild, AuditLogEvent.RoleUpdate);
  const changes: string[] = [];
  if (oldRole.name !== newRole.name) changes.push(`**Name:** \`${oldRole.name}\` → \`${newRole.name}\``);
  if (oldRole.color !== newRole.color) changes.push(`**Color:** \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push("**Permissions changed**");
  if (oldRole.hoist !== newRole.hoist) changes.push(`**Hoisted:** ${newRole.hoist}`);
  if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Mentionable:** ${newRole.mentionable}`);
  if (!changes.length) return;

  await send(newRole.guild, logEmbed(C.yellow, "⚙️  Role Updated")
    .addFields(
      { name: "Role",       value: `<@&${newRole.id}> (\`${newRole.name}\`)`, inline: true },
      { name: "Updated By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
      { name: "Changes",    value: changes.join("\n") },
    ));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHANNELS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logChannelCreate(guild: Guild, channel: GuildChannel): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.channelCreate || !cfg.logChannelId) return;

  const executor = await getExecutor(guild, AuditLogEvent.ChannelCreate);

  await send(guild, logEmbed(C.green, "📢  Channel Created")
    .addFields(
      { name: "Channel",    value: `<#${channel.id}> (\`${channel.name}\`)`, inline: true },
      { name: "Created By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
      { name: "Type",       value: `\`${channel.type}\``, inline: true },
    ));
}

export async function logChannelDelete(guild: Guild, channelName: string, channelId: string): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.channelDelete || !cfg.logChannelId) return;

  const executor = await getExecutor(guild, AuditLogEvent.ChannelDelete);

  await send(guild, logEmbed(C.red, "🗑️  Channel Deleted")
    .addFields(
      { name: "Channel Name", value: `\`#${channelName}\``, inline: true },
      { name: "Deleted By",   value: executor ? `<@${executor}>` : "Unknown", inline: true },
      { name: "ID",           value: `\`${channelId}\``, inline: true },
    ));
}

export async function logChannelUpdate(
  oldChannel: NonThreadGuildBasedChannel,
  newChannel: NonThreadGuildBasedChannel,
): Promise<void> {
  const cfg = await getLogConfig(newChannel.guild.id);
  if (!cfg.channelUpdate || !cfg.logChannelId) return;

  const executor = await getExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate);
  const changes: string[] = [];
  if (oldChannel.name !== newChannel.name) changes.push(`**Name:** \`${oldChannel.name}\` → \`${newChannel.name}\``);
  if ("topic" in oldChannel && "topic" in newChannel && oldChannel.topic !== newChannel.topic)
    changes.push(`**Topic changed**`);
  if ("nsfw" in oldChannel && "nsfw" in newChannel && oldChannel.nsfw !== newChannel.nsfw)
    changes.push(`**NSFW:** ${newChannel.nsfw}`);
  if (!changes.length) return;

  await send(newChannel.guild, logEmbed(C.yellow, "📝  Channel Updated")
    .addFields(
      { name: "Channel",    value: `<#${newChannel.id}>`, inline: true },
      { name: "Updated By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
      { name: "Changes",    value: changes.join("\n") },
    ));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SERVER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logServerUpdate(oldGuild: Guild, newGuild: Guild): Promise<void> {
  const cfg = await getLogConfig(newGuild.id);
  if (!cfg.serverUpdate || !cfg.logChannelId) return;

  const executor = await getExecutor(newGuild, AuditLogEvent.GuildUpdate);
  const changes: string[] = [];
  if (oldGuild.name !== newGuild.name) changes.push(`**Name:** \`${oldGuild.name}\` → \`${newGuild.name}\``);
  if (oldGuild.description !== newGuild.description) changes.push("**Description changed**");
  if (oldGuild.icon !== newGuild.icon) changes.push("**Icon changed**");
  if (oldGuild.verificationLevel !== newGuild.verificationLevel)
    changes.push(`**Verification level:** \`${oldGuild.verificationLevel}\` → \`${newGuild.verificationLevel}\``);
  if (!changes.length) return;

  await send(newGuild, logEmbed(C.yellow, "⚙️  Server Updated")
    .setThumbnail(newGuild.iconURL())
    .addFields(
      { name: "Updated By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
      { name: "Changes",    value: changes.join("\n") },
    ));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVITES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logInviteCreate(invite: Invite): Promise<void> {
  if (!invite.guild) return;
  const cfg = await getLogConfig(invite.guild.id);
  if (!cfg.inviteCreate || !cfg.logChannelId) return;

  await send(invite.guild as Guild, logEmbed(C.teal, "🔗  Invite Created")
    .addFields(
      { name: "Code",      value: `\`${invite.code}\``, inline: true },
      { name: "Created By", value: invite.inviter ? `<@${invite.inviter.id}>` : "Unknown", inline: true },
      { name: "Channel",   value: invite.channelId ? `<#${invite.channelId}>` : "Unknown", inline: true },
      { name: "Max Uses",  value: `\`${invite.maxUses ?? "∞"}\``, inline: true },
      { name: "Expires",   value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : "`Never`", inline: true },
    ));
}

export async function logInviteDelete(invite: Invite): Promise<void> {
  if (!invite.guild) return;
  const cfg = await getLogConfig(invite.guild.id);
  if (!cfg.inviteDelete || !cfg.logChannelId) return;

  await send(invite.guild as Guild, logEmbed(C.red, "🔗  Invite Deleted")
    .addFields(
      { name: "Code",    value: `\`${invite.code}\``, inline: true },
      { name: "Channel", value: invite.channelId ? `<#${invite.channelId}>` : "Unknown", inline: true },
    ));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THREADS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logThreadCreate(thread: ThreadChannel): Promise<void> {
  if (!thread.guild) return;
  const cfg = await getLogConfig(thread.guild.id);
  if (!cfg.threadCreate || !cfg.logChannelId) return;

  await send(thread.guild, logEmbed(C.blue, "🧵  Thread Created")
    .addFields(
      { name: "Thread",  value: `<#${thread.id}> (\`${thread.name}\`)`, inline: true },
      { name: "Parent",  value: thread.parentId ? `<#${thread.parentId}>` : "Unknown", inline: true },
      { name: "Creator", value: thread.ownerId ? `<@${thread.ownerId}>` : "Unknown", inline: true },
    ));
}

export async function logThreadDelete(thread: ThreadChannel): Promise<void> {
  if (!thread.guild) return;
  const cfg = await getLogConfig(thread.guild.id);
  if (!cfg.threadCreate || !cfg.logChannelId) return;

  await send(thread.guild, logEmbed(C.red, "🧵  Thread Deleted")
    .addFields(
      { name: "Thread Name", value: `\`${thread.name}\``, inline: true },
      { name: "Parent",      value: thread.parentId ? `<#${thread.parentId}>` : "Unknown", inline: true },
    ));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMOJI / STICKER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logEmojiCreate(emoji: GuildEmoji): Promise<void> {
  const cfg = await getLogConfig(emoji.guild.id);
  if (!cfg.emojiUpdate || !cfg.logChannelId) return;

  const executor = await getExecutor(emoji.guild, AuditLogEvent.EmojiCreate);

  await send(emoji.guild, logEmbed(C.green, "😀  Emoji Created")
    .addFields(
      { name: "Emoji",      value: `${emoji} (\`:${emoji.name}:\`)`, inline: true },
      { name: "Created By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
    ));
}

export async function logEmojiDelete(emoji: GuildEmoji): Promise<void> {
  const cfg = await getLogConfig(emoji.guild.id);
  if (!cfg.emojiUpdate || !cfg.logChannelId) return;

  const executor = await getExecutor(emoji.guild, AuditLogEvent.EmojiDelete);

  await send(emoji.guild, logEmbed(C.red, "😀  Emoji Deleted")
    .addFields(
      { name: "Emoji Name", value: `\`:${emoji.name}:\``, inline: true },
      { name: "Deleted By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
    ));
}

export async function logStickerCreate(sticker: Sticker): Promise<void> {
  const guild = sticker.guild;
  if (!guild) return;
  const cfg = await getLogConfig(guild.id);
  if (!cfg.emojiUpdate || !cfg.logChannelId) return;

  const executor = await getExecutor(guild, AuditLogEvent.StickerCreate);

  await send(guild, logEmbed(C.green, "🖼️  Sticker Created")
    .addFields(
      { name: "Sticker",    value: `\`${sticker.name}\``, inline: true },
      { name: "Created By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
    ));
}

export async function logStickerDelete(sticker: Sticker): Promise<void> {
  const guild = sticker.guild;
  if (!guild) return;
  const cfg = await getLogConfig(guild.id);
  if (!cfg.emojiUpdate || !cfg.logChannelId) return;

  const executor = await getExecutor(guild, AuditLogEvent.StickerDelete);

  await send(guild, logEmbed(C.red, "🖼️  Sticker Deleted")
    .addFields(
      { name: "Sticker",    value: `\`${sticker.name}\``, inline: true },
      { name: "Deleted By", value: executor ? `<@${executor}>` : "Unknown", inline: true },
    ));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANTINUKE ACTION (logged to log channel if enabled)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function logAntinukeAction(
  guild: Guild,
  embed: EmbedBuilder,
): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.antinukeAction || !cfg.logChannelId) return;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  if (ch instanceof TextChannel) await ch.send({ embeds: [embed] }).catch(() => {});
}
