import {
  SlashCommandBuilder, REST, Routes, Client,
  ChatInputCommandInteraction, EmbedBuilder,
  PermissionFlagsBits, GuildMember, TextChannel,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
} from "discord.js";
import {
  getGuildSettings, updateGuildSettings, getAntiNukeConfig, updateAntiNukeConfig,
  addWhitelist, removeWhitelist, getWhitelist, addExtraOwner, removeExtraOwner,
  getExtraOwners, addAutoRole, removeAutoRole, getAutoRoles, updateLogConfig,
  getLogConfig, addCustomCommand, removeCustomCommand, getCustomCommands,
  addReactionRole, getAllReactionRoles, getOrCreateUserLevel, getOrCreateUserEconomy,
  addLevelRole, setUnbypssableRole, getAllUnbypssableRoles, ensureGuild,
} from "../database.js";
import {
  isTrustedUser, checkAction,
} from "../systems/antinuke.js";
import { activateLockdown, deactivateLockdown } from "../systems/antiraid.js";
import { captureSnapshot, recoverDeletedChannel, recoverDeletedRole } from "../systems/recovery.js";
import { sendTicketPanel } from "../systems/tickets.js";
import { startGiveaway, rerollGiveaway } from "../systems/giveaway.js";
import {
  dailyReward, workReward, transferBalance, deposit, withdraw,
  buildLeaderboard as buildEcoLeaderboard, formatMs,
} from "../systems/economy.js";
import {
  buildRankEmbed, buildLeaderboard as buildLevelLeaderboard,
} from "../systems/leveling.js";
import {
  toggleEmbed, successEmbed, errorEmbed, infoEmbed, warningEmbed,
  antinukeStatusEmbed, balanceEmbed, lockdownEmbed, BRAND,
} from "../embed.js";
import { COLORS, ECONOMY_CURRENCY, UNBYPSSABLE_ROLE_NAME, xpForLevel, UNIVERSAL_OWNER_ID } from "../config.js";
import { logger } from "../../lib/logger.js";

const ANTINUKE_MODULE_CHOICES = [
  { name: "Anti Ban",                 value: "antiBan" },
  { name: "Anti Kick",                value: "antiKick" },
  { name: "Anti Prune",               value: "antiPrune" },
  { name: "Anti Bot Add",             value: "antiBotAdd" },
  { name: "Anti Server Update",       value: "antiServerUpdate" },
  { name: "Anti Member Role Update",  value: "antiMemberRoleUpdate" },
  { name: "Anti Channel Create",      value: "antiChannelCreate" },
  { name: "Anti Channel Delete",      value: "antiChannelDelete" },
  { name: "Anti Channel Update",      value: "antiChannelUpdate" },
  { name: "Anti Role Create",         value: "antiRoleCreate" },
  { name: "Anti Role Delete",         value: "antiRoleDelete" },
  { name: "Anti Role Update",         value: "antiRoleUpdate" },
  { name: "Anti @everyone/here Ping", value: "antiMentionEveryone" },
  { name: "Anti Webhook Create",      value: "antiWebhookCreate" },
  { name: "Anti Webhook Delete",      value: "antiWebhookDelete" },
  { name: "Anti Emoji Create",        value: "antiEmojiCreate" },
  { name: "Anti Emoji Delete",        value: "antiEmojiDelete" },
  { name: "Anti Sticker Create",      value: "antiStickerCreate" },
  { name: "Anti Sticker Delete",      value: "antiStickerDelete" },
];

// Build the interactive button panel for antinuke module toggles
export function buildAntinukePanel(
  guildName: string,
  cfg: Record<string, unknown>,
  guildId: string,
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const MOD = (on: unknown) => on ? "✅" : "❌";
  const lines = ANTINUKE_MODULE_CHOICES.map(m => `${MOD(cfg[m.value])}  ${m.name}`).join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x000000)
    .setTitle(`AntiNuke Configuration Panel — ${guildName}`)
    .setDescription(
      `Toggle modules below.\nClick any button to enable/disable that module.\n\n**Module Status**\n${lines}`,
    )
    .setFooter({ text: "Shonargaon Antinuke  ·  Toggle Panel", iconURL: BRAND.icon ?? undefined })
    .setTimestamp();

  // Build button rows (max 5 per row, max 5 rows = 25 buttons)
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let count = 0;

  for (const mod of ANTINUKE_MODULE_CHOICES) {
    if (count > 0 && count % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
    const enabled = cfg[mod.value] as boolean ?? true;
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`antinuke:toggle:${mod.value}:${guildId}`)
        .setLabel(mod.name.replace("Anti ", ""))
        .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Danger)
        .setEmoji(enabled ? "✅" : "❌"),
    );
    count++;
  }
  if (currentRow.components.length > 0) rows.push(currentRow);

  return { embed, components: rows };
}

const commands = [
  // ── ANTINUKE ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("antinuke").setDescription("Antinuke system")
    .addSubcommand(s => s.setName("enable").setDescription("Enable antinuke"))
    .addSubcommand(s => s.setName("disable").setDescription("Disable antinuke"))
    .addSubcommand(s => s.setName("status").setDescription("Show full module status"))
    .addSubcommand(s => s.setName("panel").setDescription("Open interactive toggle panel for all modules"))
    .addSubcommand(s => s.setName("toggle").setDescription("Toggle a specific antinuke module on/off")
      .addStringOption(o => o.setName("module").setDescription("Module to toggle").setRequired(true)
        .addChoices(...ANTINUKE_MODULE_CHOICES)))
    .addSubcommand(s => s.setName("config").setDescription("Configure punishment and limits")
      .addStringOption(o => o.setName("action").setDescription("Punishment action").addChoices(
        { name: "Ban", value: "ban" },
        { name: "Kick", value: "kick" },
        { name: "Strip Roles", value: "strip_roles" },
      ))
      .addIntegerOption(o => o.setName("max_bans").setDescription("Max bans (0=zero tolerance)").setMinValue(0).setMaxValue(20))
      .addIntegerOption(o => o.setName("max_kicks").setDescription("Max kicks (0=zero tolerance)").setMinValue(0).setMaxValue(20))
      .addIntegerOption(o => o.setName("max_channel_delete").setDescription("Max channel deletions (0=zero tolerance)").setMinValue(0).setMaxValue(10))
      .addIntegerOption(o => o.setName("max_role_delete").setDescription("Max role deletions (0=zero tolerance)").setMinValue(0).setMaxValue(10))
      .addIntegerOption(o => o.setName("interval").setDescription("Interval in seconds").setMinValue(5).setMaxValue(60))
    ),

  // ── WHITELIST ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("whitelist").setDescription("Manage whitelist")
    .addSubcommand(s => s.setName("add").setDescription("Add user to whitelist")
      .addUserOption(o => o.setName("user").setDescription("User to whitelist").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove user from whitelist")
      .addUserOption(o => o.setName("user").setDescription("User to remove").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("List whitelisted users"))
    .addSubcommand(s => s.setName("check").setDescription("Check what antinuke modules apply to a user")
      .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(true))),

  // ── EXTRAOWNER ────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("extraowner").setDescription("Manage extra owners (server owner only)")
    .addSubcommand(s => s.setName("add").setDescription("Add extra owner")
      .addUserOption(o => o.setName("user").setDescription("User to add").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove extra owner")
      .addUserOption(o => o.setName("user").setDescription("User to remove").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("List extra owners")),

  // ── WELCOME ───────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("welcome").setDescription("Configure welcome/goodbye")
    .addSubcommand(s => s.setName("enable").setDescription("Enable welcome messages")
      .addChannelOption(o => o.setName("channel").setDescription("Welcome channel").setRequired(true))
      .addStringOption(o => o.setName("message").setDescription("Message ({user} {username} {server} {count})")))
    .addSubcommand(s => s.setName("disable").setDescription("Disable welcome messages"))
    .addSubcommand(s => s.setName("goodbye").setDescription("Enable goodbye messages")
      .addChannelOption(o => o.setName("channel").setDescription("Goodbye channel").setRequired(true))
      .addStringOption(o => o.setName("message").setDescription("Message ({user} {username} {server})")))
    .addSubcommand(s => s.setName("test").setDescription("Test welcome message")),

  // ── AUTOROLE ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("autorole").setDescription("Manage auto-roles")
    .addSubcommand(s => s.setName("add").setDescription("Add auto-role")
      .addRoleOption(o => o.setName("role").setDescription("Role to auto-assign").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove auto-role")
      .addRoleOption(o => o.setName("role").setDescription("Role to remove").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("List auto-roles")),

  // ── TICKET ────────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("ticket").setDescription("Ticket system")
    .addSubcommand(s => s.setName("setup").setDescription("Setup ticket panel")
      .addChannelOption(o => o.setName("channel").setDescription("Channel for ticket panel").setRequired(true))
      .addChannelOption(o => o.setName("category").setDescription("Category for ticket channels"))
      .addRoleOption(o => o.setName("support_role").setDescription("Support role"))),

  // ── LOGGING ───────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("logging").setDescription("Configure logging")
    .addSubcommand(s => s.setName("setup").setDescription("Set log channel")
      .addChannelOption(o => o.setName("channel").setDescription("Log channel").setRequired(true)))
    .addSubcommand(s => s.setName("disable").setDescription("Disable logging"))
    .addSubcommand(s => s.setName("toggle").setDescription("Toggle specific log events")
      .addStringOption(o => o.setName("event").setDescription("Event type").setRequired(true).addChoices(
        { name: "Message Delete", value: "messageDelete" },
        { name: "Message Edit", value: "messageEdit" },
        { name: "Member Join", value: "memberJoin" },
        { name: "Member Leave", value: "memberLeave" },
        { name: "Bans", value: "memberBan" },
        { name: "Role Events", value: "roleCreate" },
        { name: "Channel Events", value: "channelCreate" },
        { name: "Nickname Changes", value: "nicknameChange" },
      ))
      .addBooleanOption(o => o.setName("enabled").setDescription("Enable or disable").setRequired(true))),

  // ── GIVEAWAY ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("giveaway").setDescription("Giveaway system")
    .addSubcommand(s => s.setName("start").setDescription("Start a giveaway")
      .addChannelOption(o => o.setName("channel").setDescription("Channel for giveaway").setRequired(true))
      .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
      .addStringOption(o => o.setName("duration").setDescription("Duration (e.g. 10m, 1h, 1d)").setRequired(true))
      .addIntegerOption(o => o.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(20))
      .addStringOption(o => o.setName("requirements").setDescription("Entry requirements")))
    .addSubcommand(s => s.setName("reroll").setDescription("Reroll a giveaway")
      .addIntegerOption(o => o.setName("id").setDescription("Giveaway ID").setRequired(true))),

  // ── LEVELING ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("rank").setDescription("Check your rank or another user's")
    .addUserOption(o => o.setName("user").setDescription("User to check")),

  new SlashCommandBuilder().setName("leaderboard").setDescription("View the server leaderboard")
    .addStringOption(o => o.setName("type").setDescription("Leaderboard type").addChoices(
      { name: "Levels", value: "levels" },
      { name: "Economy", value: "economy" },
    )),

  new SlashCommandBuilder().setName("levelrole").setDescription("Set a role reward for reaching a level")
    .addIntegerOption(o => o.setName("level").setDescription("Level required").setRequired(true).setMinValue(1))
    .addRoleOption(o => o.setName("role").setDescription("Role to assign").setRequired(true)),

  // ── ECONOMY ───────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("balance").setDescription("Check your balance")
    .addUserOption(o => o.setName("user").setDescription("User to check")),

  new SlashCommandBuilder().setName("daily").setDescription("Claim your daily reward"),
  new SlashCommandBuilder().setName("work").setDescription("Work for coins"),

  new SlashCommandBuilder().setName("pay").setDescription("Pay another user")
    .addUserOption(o => o.setName("user").setDescription("User to pay").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount to pay").setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName("deposit").setDescription("Deposit to bank")
    .addStringOption(o => o.setName("amount").setDescription("Amount or 'all'").setRequired(true)),

  new SlashCommandBuilder().setName("withdraw").setDescription("Withdraw from bank")
    .addStringOption(o => o.setName("amount").setDescription("Amount or 'all'").setRequired(true)),

  // ── ANTIRAID ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("antiraid").setDescription("Anti-raid settings")
    .addSubcommand(s => s.setName("enable").setDescription("Enable anti-raid protection")
      .addIntegerOption(o => o.setName("threshold").setDescription("Joins per interval to trigger lockdown").setMinValue(3).setMaxValue(50))
      .addIntegerOption(o => o.setName("interval").setDescription("Interval in seconds").setMinValue(5).setMaxValue(60)))
    .addSubcommand(s => s.setName("disable").setDescription("Disable anti-raid"))
    .addSubcommand(s => s.setName("lock").setDescription("Manually lock all channels"))
    .addSubcommand(s => s.setName("unlock").setDescription("Unlock all channels")),

  // ── CUSTOM COMMANDS ────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("tag").setDescription("Custom command/tag system")
    .addSubcommand(s => s.setName("create").setDescription("Create a custom command")
      .addStringOption(o => o.setName("name").setDescription("Command trigger").setRequired(true))
      .addStringOption(o => o.setName("response").setDescription("Response (prefix with 'embed:' for embed)").setRequired(true)))
    .addSubcommand(s => s.setName("delete").setDescription("Delete a custom command")
      .addStringOption(o => o.setName("name").setDescription("Command name").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("List all custom commands")),

  // ── REACTION ROLES ────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("reactionrole").setDescription("Manage reaction roles")
    .addSubcommand(s => s.setName("add").setDescription("Add reaction role")
      .addStringOption(o => o.setName("message_id").setDescription("Message ID").setRequired(true))
      .addStringOption(o => o.setName("emoji").setDescription("Emoji").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role to assign").setRequired(true))
      .addStringOption(o => o.setName("mode").setDescription("Mode").addChoices(
        { name: "Toggle", value: "toggle" },
        { name: "Add only", value: "add" },
        { name: "Remove only", value: "remove" },
      )))
    .addSubcommand(s => s.setName("list").setDescription("List all reaction roles")),

  // ── VERIFICATION ──────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("verification").setDescription("Verification system")
    .addSubcommand(s => s.setName("enable").setDescription("Enable captcha verification")
      .addChannelOption(o => o.setName("channel").setDescription("Verification channel").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role given after verification")))
    .addSubcommand(s => s.setName("disable").setDescription("Disable verification")),

  // ── UNBYPSSABLE ROLE ──────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("protect").setDescription("Protect a user with an unbypssable role")
    .addUserOption(o => o.setName("user").setDescription("User to protect").setRequired(true)),

  // ── RECOVER ───────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("recover").setDescription("Recover server from snapshot after a nuke")
    .addSubcommand(s => s.setName("channels").setDescription("Restore all deleted channels from last snapshot"))
    .addSubcommand(s => s.setName("roles").setDescription("Restore all deleted roles from last snapshot"))
    .addSubcommand(s => s.setName("all").setDescription("Restore all deleted channels AND roles"))
    .addSubcommand(s => s.setName("snapshot").setDescription("Take a fresh snapshot of the current server state")),

  // ── BOTINFO ───────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("botinfo").setDescription("Show bot information"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information"),
  new SlashCommandBuilder().setName("userinfo").setDescription("Show user information")
    .addUserOption(o => o.setName("user").setDescription("User to check")),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
].map(cmd => cmd.toJSON());

export async function registerCommands(client: Client): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token || !client.user) return;

  const rest = new REST().setToken(token);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    logger.info("Slash commands registered globally");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }
}

function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const n = parseInt(match[1]!);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * multipliers[unit]!;
}

function requireAdmin(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member as GuildMember;
  if (!member) return false;
  if (interaction.user.id === UNIVERSAL_OWNER_ID) return true;
  if (interaction.guild?.ownerId === interaction.user.id) return true;
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

async function requireTrusted(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild) return false;
  return isTrustedUser(interaction.guild, interaction.user.id);
}

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction;
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  await ensureGuild(interaction.guild.id);

  try {
    switch (commandName) {
      case "ping": {
        const lat = Date.now() - interaction.createdTimestamp;
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(BRAND.color)
            .setTitle("🏓  Pong!")
            .addFields(
              { name: "📡  Bot Latency", value: `\`${lat}ms\``, inline: true },
              { name: "⚙️  API Latency", value: `\`${Math.round(interaction.client.ws.ping)}ms\``, inline: true },
            )
            .setFooter({ text: BRAND.name, iconURL: BRAND.icon ?? undefined })
            .setTimestamp()],
        });
        break;
      }

      case "botinfo":
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(BRAND.color)
            .setAuthor({ name: BRAND.name, iconURL: interaction.client.user!.displayAvatarURL() })
            .setThumbnail(interaction.client.user!.displayAvatarURL())
            .setDescription("Advanced Discord protection bot with antinuke, verification, leveling, economy, and more.\n\u200b")
            .addFields(
              { name: "🏠  Servers", value: `\`${interaction.client.guilds.cache.size}\``, inline: true },
              { name: "👥  Users", value: `\`${interaction.client.users.cache.size}\``, inline: true },
              { name: "📡  Ping", value: `\`${Math.round(interaction.client.ws.ping)}ms\``, inline: true },
              { name: "🔖  Version", value: "`1.0.0`", inline: true },
            )
            .setFooter({ text: BRAND.name, iconURL: BRAND.icon ?? undefined })
            .setTimestamp()],
        });
        break;

      case "serverinfo": {
        const g = interaction.guild;
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(BRAND.color)
            .setAuthor({ name: g.name, iconURL: g.iconURL() ?? undefined })
            .setThumbnail(g.iconURL())
            .addFields(
              { name: "👥  Members", value: `\`${g.memberCount}\``, inline: true },
              { name: "📁  Channels", value: `\`${g.channels.cache.size}\``, inline: true },
              { name: "🏷️  Roles", value: `\`${g.roles.cache.size}\``, inline: true },
              { name: "👑  Owner", value: `<@${g.ownerId}>`, inline: true },
              { name: "📅  Created", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
            )
            .setFooter({ text: BRAND.name, iconURL: BRAND.icon ?? undefined })
            .setTimestamp()],
        });
        break;
      }

      case "userinfo": {
        const target = interaction.options.getUser("user") ?? interaction.user;
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        const embed = new EmbedBuilder()
          .setColor(BRAND.color)
          .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
          .setThumbnail(target.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: "🆔  ID", value: `\`${target.id}\``, inline: true },
            { name: "📅  Account Created", value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
          )
          .setFooter({ text: BRAND.name, iconURL: BRAND.icon ?? undefined })
          .setTimestamp();
        if (member) {
          embed.addFields(
            { name: "📥  Joined Server", value: `<t:${Math.floor((member.joinedTimestamp ?? 0) / 1000)}:R>`, inline: true },
            { name: "🏷️  Roles", value: member.roles.cache.filter(r => r.id !== interaction.guild!.id).map(r => `<@&${r.id}>`).slice(0, 10).join(", ") || "`None`" },
          );
        }
        await interaction.reply({ embeds: [embed] });
        break;
      }

      // ── ANTINUKE ────────────────────────────────────────────────────────
      case "antinuke": {
        if (!requireAdmin(interaction)) {
          await interaction.reply({ content: "❌ You need Administrator permission.", ephemeral: true }); return;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === "enable") {
          await updateGuildSettings(interaction.guild.id, { antiNukeEnabled: true });
          await interaction.reply({ embeds: [toggleEmbed("⚡  Antinuke", true)] });

        } else if (sub === "disable") {
          await updateGuildSettings(interaction.guild.id, { antiNukeEnabled: false });
          await interaction.reply({ embeds: [toggleEmbed("⚡  Antinuke", false)] });

        } else if (sub === "status") {
          const settings = await getGuildSettings(interaction.guild.id);
          const cfg = await getAntiNukeConfig(interaction.guild.id);
          await interaction.reply({
            embeds: [antinukeStatusEmbed(interaction.guild.name, settings.antiNukeEnabled, cfg)],
          });

        } else if (sub === "panel") {
          if (!await requireTrusted(interaction)) {
            await interaction.reply({ embeds: [errorEmbed("Only trusted users can open the panel.")], ephemeral: true }); return;
          }
          const cfg = await getAntiNukeConfig(interaction.guild.id);
          const { embed, components } = buildAntinukePanel(
            interaction.guild.name, cfg as unknown as Record<string, unknown>, interaction.guild.id,
          );
          await interaction.reply({ embeds: [embed], components });

        } else if (sub === "toggle") {
          if (!await requireTrusted(interaction)) {
            await interaction.reply({ embeds: [errorEmbed("Only trusted users can toggle modules.")], ephemeral: true }); return;
          }
          const module = interaction.options.getString("module", true);
          const cfg = await getAntiNukeConfig(interaction.guild.id);
          const current = (cfg as unknown as Record<string, unknown>)[module] as boolean ?? true;
          await updateAntiNukeConfig(interaction.guild.id, { [module]: !current } as any);
          const label = ANTINUKE_MODULE_CHOICES.find(m => m.value === module)?.name ?? module;
          await interaction.reply({
            embeds: [toggleEmbed(`⚡  ${label}`, !current)],
          });

        } else if (sub === "config") {
          const updates: Record<string, unknown> = {};
          const maxBans   = interaction.options.getInteger("max_bans");
          const maxKicks  = interaction.options.getInteger("max_kicks");
          const maxChDel  = interaction.options.getInteger("max_channel_delete");
          const maxRoleDel = interaction.options.getInteger("max_role_delete");
          const interval  = interaction.options.getInteger("interval");
          const action    = interaction.options.getString("action");
          if (maxBans    !== null) updates["maxBans"]          = maxBans;
          if (maxKicks   !== null) updates["maxKicks"]         = maxKicks;
          if (maxChDel   !== null) updates["maxChannelDelete"] = maxChDel;
          if (maxRoleDel !== null) updates["maxRoleDelete"]    = maxRoleDel;
          if (interval   !== null) updates["intervalSeconds"]  = interval;
          if (action) updates["punishAction"] = action;
          if (Object.keys(updates).length > 0) {
            await updateAntiNukeConfig(interaction.guild.id, updates);
          }
          const settings2 = await getGuildSettings(interaction.guild.id);
          const cfg2 = await getAntiNukeConfig(interaction.guild.id);
          await interaction.reply({
            embeds: [antinukeStatusEmbed(interaction.guild.name, settings2.antiNukeEnabled, cfg2)],
          });
        }
        break;
      }

      // ── WHITELIST ────────────────────────────────────────────────────────
      case "whitelist": {
        if (!await requireTrusted(interaction)) {
          await interaction.reply({ content: "❌ Only trusted users can manage whitelist.", ephemeral: true }); return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === "add") {
          const user = interaction.options.getUser("user", true);
          await addWhitelist(interaction.guild.id, user.id, interaction.user.id);
          await interaction.reply({ embeds: [successEmbed(`<@${user.id}> has been added to the whitelist.`)] });

        } else if (sub === "remove") {
          const user = interaction.options.getUser("user", true);
          await removeWhitelist(interaction.guild.id, user.id);
          await interaction.reply({ embeds: [successEmbed(`<@${user.id}> has been removed from the whitelist.`)] });

        } else if (sub === "list") {
          const list = await getWhitelist(interaction.guild.id);
          await interaction.reply({
            embeds: [infoEmbed("📋  Whitelist", list.length ? list.map(u => `> <@${u.userId}>`).join("\n") : "> *No whitelisted users.*")],
          });

        } else if (sub === "check") {
          const target = interaction.options.getUser("user", true);
          await interaction.deferReply();

          const cfg = await getAntiNukeConfig(interaction.guild.id);
          const settings = await getGuildSettings(interaction.guild.id);

          // Determine trust level of the target user
          const isOwner = target.id === interaction.guild.ownerId || target.id === UNIVERSAL_OWNER_ID;
          const isExtra = (await getExtraOwners(interaction.guild.id)).some(e => e.userId === target.id);
          const isWL    = (await getWhitelist(interaction.guild.id)).some(w => w.userId === target.id);
          const trusted = isOwner || isExtra || isWL;

          // Build the per-module line list:
          // Column 1 (exemption): ✅ = exempt (trusted), ❌ = not exempt (will be punished)
          // Column 2 (module):    ✅ = module enabled,   ❌ = module disabled
          const MODULE_MAP: [string, string, boolean][] = [
            ["Anti Ban",                 "antiBan",              cfg.antiBan],
            ["Anti Kick",                "antiKick",             cfg.antiKick],
            ["Anti Prune",               "antiPrune",            cfg.antiPrune],
            ["Anti Bot Add",             "antiBotAdd",           cfg.antiBotAdd],
            ["Anti Server Update",       "antiServerUpdate",     cfg.antiServerUpdate],
            ["Anti Member Role Update",  "antiMemberRoleUpdate", cfg.antiMemberRoleUpdate],
            ["Anti Channel Create",      "antiChannelCreate",    cfg.antiChannelCreate],
            ["Anti Channel Delete",      "antiChannelDelete",    cfg.antiChannelDelete],
            ["Anti Channel Update",      "antiChannelUpdate",    cfg.antiChannelUpdate],
            ["Anti Role Create",         "antiRoleCreate",       cfg.antiRoleCreate],
            ["Anti Role Delete",         "antiRoleDelete",       cfg.antiRoleDelete],
            ["Anti Role Update",         "antiRoleUpdate",       cfg.antiRoleUpdate],
            ["Mention @everyone",        "antiMentionEveryone",  cfg.antiMentionEveryone],
            ["Webhook Create",           "antiWebhookCreate",    cfg.antiWebhookCreate],
            ["Webhook Update",           "antiWebhookDelete",    cfg.antiWebhookDelete],
            ["Webhook Delete",           "antiWebhookDelete",    cfg.antiWebhookDelete],
            ["Emoji Create",             "antiEmojiCreate",      cfg.antiEmojiCreate],
            ["Emoji Update",             "antiEmojiCreate",      cfg.antiEmojiCreate],
            ["Emoji Delete",             "antiEmojiDelete",      cfg.antiEmojiDelete],
            ["Sticker Create",           "antiStickerCreate",    cfg.antiStickerCreate],
            ["Sticker Update",           "antiStickerCreate",    cfg.antiStickerCreate],
            ["Sticker Delete",           "antiStickerDelete",    cfg.antiStickerDelete],
          ];

          const lines = MODULE_MAP.map(([label, , modEnabled]) => {
            const ex  = trusted ? "✅" : "❌";   // exemption status
            const mod = modEnabled ? "✅" : "❌"; // module status
            return `${ex} ${mod}  : ${label}`;
          }).join("\n");

          const trustLabel = isOwner ? "Server Owner / Universal Owner"
            : isExtra ? "Extra Owner"
            : isWL    ? "Whitelisted"
            : "Not Trusted — will be punished";

          const embed = new EmbedBuilder()
            .setColor(trusted ? 0x57f287 : 0xed4245)
            .setAuthor({
              name: `🔒  ${interaction.guild.name}`,
              iconURL: interaction.guild.iconURL() ?? undefined,
            })
            .setDescription(lines)
            .addFields(
              { name: "Executor", value: `<@${interaction.user.id}>`, inline: true },
              { name: "Target",   value: `<@${target.id}>`,           inline: true },
              { name: "Status",   value: trustLabel,                  inline: false },
            )
            .setFooter({
              text: `Shonargaon Antinuke  ·  Whitelist Check  ·  ${settings.antiNukeEnabled ? "Protection Active" : "Protection Disabled"}`,
              iconURL: BRAND.icon ?? undefined,
            })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        }
        break;
      }

      // ── EXTRAOWNER ───────────────────────────────────────────────────────
      case "extraowner": {
        const isOwner = interaction.guild.ownerId === interaction.user.id || interaction.user.id === UNIVERSAL_OWNER_ID;
        if (!isOwner) {
          await interaction.reply({ content: "❌ Only the server owner can manage extra owners.", ephemeral: true }); return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === "add") {
          const user = interaction.options.getUser("user", true);
          await addExtraOwner(interaction.guild.id, user.id, interaction.user.id);
          await interaction.reply({ embeds: [successEmbed(`<@${user.id}> is now an **Extra Owner**.`)] });
        } else if (sub === "remove") {
          const user = interaction.options.getUser("user", true);
          await removeExtraOwner(interaction.guild.id, user.id);
          await interaction.reply({ embeds: [successEmbed(`<@${user.id}> has been removed from extra owners.`)] });
        } else if (sub === "list") {
          const list = await getExtraOwners(interaction.guild.id);
          await interaction.reply({
            embeds: [infoEmbed("👑  Extra Owners", list.length ? list.map(u => `> <@${u.userId}>`).join("\n") : "> *No extra owners set.*")],
          });
        }
        break;
      }

      // ── WELCOME ──────────────────────────────────────────────────────────
      case "welcome": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const sub = interaction.options.getSubcommand();
        if (sub === "enable") {
          const ch = interaction.options.getChannel("channel", true);
          const msg = interaction.options.getString("message") ?? undefined;
          await updateGuildSettings(interaction.guild.id, { welcomeEnabled: true, welcomeChannelId: ch.id, welcomeMessage: msg ?? null });
          await interaction.reply({ embeds: [toggleEmbed("👋  Welcome Messages", true, [{ name: "📢  Channel", value: `<#${ch.id}>`, inline: true }])] });
        } else if (sub === "disable") {
          await updateGuildSettings(interaction.guild.id, { welcomeEnabled: false });
          await interaction.reply({ embeds: [toggleEmbed("👋  Welcome Messages", false)] });
        } else if (sub === "goodbye") {
          const ch = interaction.options.getChannel("channel", true);
          const msg = interaction.options.getString("message") ?? undefined;
          await updateGuildSettings(interaction.guild.id, { goodbyeEnabled: true, goodbyeChannelId: ch.id, goodbyeMessage: msg ?? null });
          await interaction.reply({ embeds: [toggleEmbed("👋  Goodbye Messages", true, [{ name: "📢  Channel", value: `<#${ch.id}>`, inline: true }])] });
        } else if (sub === "test") {
          const { handleMemberJoin } = await import("../systems/welcome.js");
          const member = interaction.member as GuildMember;
          await handleMemberJoin(member);
          await interaction.reply({ embeds: [successEmbed("Test welcome message sent.")], ephemeral: true });
        }
        break;
      }

      // ── AUTOROLE ─────────────────────────────────────────────────────────
      case "autorole": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const sub = interaction.options.getSubcommand();
        if (sub === "add") {
          const role = interaction.options.getRole("role", true);
          await addAutoRole(interaction.guild.id, role.id);
          await interaction.reply({ embeds: [successEmbed(`<@&${role.id}> added as auto-role.`)] });
        } else if (sub === "remove") {
          const role = interaction.options.getRole("role", true);
          await removeAutoRole(interaction.guild.id, role.id);
          await interaction.reply({ embeds: [successEmbed(`<@&${role.id}> removed from auto-roles.`)] });
        } else if (sub === "list") {
          const list = await getAutoRoles(interaction.guild.id);
          await interaction.reply({
            embeds: [infoEmbed("🎭  Auto-Roles", list.length ? list.map(r => `> <@&${r.roleId}>`).join("\n") : "> *No auto-roles set.*")],
          });
        }
        break;
      }

      // ── TICKET ───────────────────────────────────────────────────────────
      case "ticket": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const sub = interaction.options.getSubcommand();
        if (sub === "setup") {
          const ch = interaction.options.getChannel("channel", true) as TextChannel;
          const cat = interaction.options.getChannel("category");
          const role = interaction.options.getRole("support_role");
          await interaction.deferReply({ ephemeral: true });
          await sendTicketPanel(interaction.guild, ch, cat?.id, role?.id);
          await interaction.editReply({ embeds: [successEmbed(`Ticket panel sent to <#${ch.id}>.`)] });
        }
        break;
      }

      // ── LOGGING ──────────────────────────────────────────────────────────
      case "logging": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const sub = interaction.options.getSubcommand();
        if (sub === "setup") {
          const ch = interaction.options.getChannel("channel", true);
          await updateGuildSettings(interaction.guild.id, { logChannelId: ch.id });
          await updateLogConfig(interaction.guild.id, { logChannelId: ch.id });
          await interaction.reply({ embeds: [toggleEmbed("📋  Logging", true, [{ name: "📢  Log Channel", value: `<#${ch.id}>`, inline: true }])] });
        } else if (sub === "disable") {
          await updateLogConfig(interaction.guild.id, { logChannelId: undefined });
          await interaction.reply({ embeds: [toggleEmbed("📋  Logging", false)] });
        } else if (sub === "toggle") {
          const event = interaction.options.getString("event", true);
          const enabled = interaction.options.getBoolean("enabled", true);
          await updateLogConfig(interaction.guild.id, { [event]: enabled });
          await interaction.reply({ embeds: [toggleEmbed(`📋  Log — \`${event}\``, enabled)] });
        }
        break;
      }

      // ── GIVEAWAY ─────────────────────────────────────────────────────────
      case "giveaway": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const sub = interaction.options.getSubcommand();
        if (sub === "start") {
          const ch = interaction.options.getChannel("channel", true);
          const prize = interaction.options.getString("prize", true);
          const durationStr = interaction.options.getString("duration", true);
          const winners = interaction.options.getInteger("winners") ?? 1;
          const requirements = interaction.options.getString("requirements") ?? undefined;
          const durationMs = parseDuration(durationStr);
          if (!durationMs) {
            await interaction.reply({ content: "❌ Invalid duration. Use format like `10m`, `1h`, `1d`.", ephemeral: true }); return;
          }
          await interaction.deferReply({ ephemeral: true });
          const result = await startGiveaway(interaction.client, interaction.guild.id, ch.id, interaction.user.id, prize, winners, durationMs, requirements);
          if (result.success) {
            await interaction.editReply({ embeds: [successEmbed(`Giveaway started in <#${ch.id}>! ID: \`${result.id}\``)] });
          } else {
            await interaction.editReply({ embeds: [errorEmbed(result.error ?? "Failed to start giveaway.")] });
          }
        } else if (sub === "reroll") {
          const id = interaction.options.getInteger("id", true);
          const winners = await rerollGiveaway(interaction.client, id);
          if (winners.length > 0) {
            await interaction.reply({ embeds: [successEmbed(`New winners: ${winners.map(w => `<@${w}>`).join("  •  ")}`, "🎉  Giveaway Rerolled")] });
          } else {
            await interaction.reply({ embeds: [errorEmbed("No entries found for this giveaway.")], ephemeral: true });
          }
        }
        break;
      }

      // ── RANK / LEADERBOARD ───────────────────────────────────────────────
      case "rank": {
        const target = interaction.options.getUser("user") ?? interaction.user;
        const userLevel = await getOrCreateUserLevel(interaction.guild.id, target.id);
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) { await interaction.reply({ content: "User not found.", ephemeral: true }); return; }
        const nextLevelXp = xpForLevel(userLevel.level);
        await interaction.reply({ embeds: [buildRankEmbed(member, userLevel.level, userLevel.xp, userLevel.totalXp, nextLevelXp)] });
        break;
      }

      case "leaderboard": {
        const type = interaction.options.getString("type") ?? "levels";
        if (type === "economy") {
          await interaction.reply({ embeds: [await buildEcoLeaderboard(interaction.guild.id, interaction.guild.name)] });
        } else {
          await interaction.reply({ embeds: [await buildLevelLeaderboard(interaction.guild.id, interaction.guild.name)] });
        }
        break;
      }

      case "levelrole": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const level = interaction.options.getInteger("level", true);
        const role = interaction.options.getRole("role", true);
        await addLevelRole(interaction.guild.id, level, role.id);
        await interaction.reply({ embeds: [successEmbed(`<@&${role.id}> will be awarded at **Level ${level}**.`)] });
        break;
      }

      // ── ECONOMY ──────────────────────────────────────────────────────────
      case "balance": {
        const target = interaction.options.getUser("user") ?? interaction.user;
        const eco = await getOrCreateUserEconomy(interaction.guild.id, target.id);
        await interaction.reply({
          embeds: [balanceEmbed(target.username, target.displayAvatarURL({ size: 256 }), eco.wallet, eco.bank, ECONOMY_CURRENCY)],
        });
        break;
      }

      case "daily": {
        const result = await dailyReward(interaction.guild.id, interaction.user.id);
        if (result.success) {
          await interaction.reply({ embeds: [successEmbed(`You claimed your daily reward of **${ECONOMY_CURRENCY} ${result.amount?.toLocaleString()}**!`, "💰  Daily Reward")] });
        } else {
          const remaining = result.nextAvailable!.getTime() - Date.now();
          await interaction.reply({ embeds: [errorEmbed(`Daily on cooldown. Come back in **${formatMs(remaining)}**.\u200b`, "⏳  Cooldown Active")] });
        }
        break;
      }

      case "work": {
        const result = await workReward(interaction.guild.id, interaction.user.id);
        if (result.success) {
          await interaction.reply({ embeds: [successEmbed(`${result.message} **${ECONOMY_CURRENCY} ${result.amount?.toLocaleString()}**`, "💼  Work")] });
        } else {
          const remaining = result.nextAvailable!.getTime() - Date.now();
          await interaction.reply({ embeds: [errorEmbed(`Work cooldown active. Try again in **${formatMs(remaining)}**.`, "⏳  Cooldown Active")] });
        }
        break;
      }

      case "pay": {
        const target = interaction.options.getUser("user", true);
        const amount = interaction.options.getInteger("amount", true);
        if (target.id === interaction.user.id) { await interaction.reply({ embeds: [errorEmbed("You cannot pay yourself.")], ephemeral: true }); return; }
        const result = await transferBalance(interaction.guild.id, interaction.user.id, target.id, amount);
        if (result.success) {
          await interaction.reply({ embeds: [successEmbed(`Sent **${ECONOMY_CURRENCY} ${amount.toLocaleString()}** to <@${target.id}>.`, "💸  Payment Sent")] });
        } else {
          await interaction.reply({ embeds: [errorEmbed(result.error ?? "Transfer failed.")] });
        }
        break;
      }

      case "deposit": {
        const amtStr = interaction.options.getString("amount", true);
        const amt = amtStr.toLowerCase() === "all" ? "all" : parseInt(amtStr);
        if (typeof amt === "number" && isNaN(amt)) { await interaction.reply({ content: "❌ Invalid amount.", ephemeral: true }); return; }
        const result = await deposit(interaction.guild.id, interaction.user.id, amt);
        if (result.success) {
          await interaction.reply({ embeds: [successEmbed(`Deposited **${ECONOMY_CURRENCY} ${result.deposited?.toLocaleString()}** to your bank.`, "🏦  Deposit")] });
        } else {
          await interaction.reply({ embeds: [errorEmbed(result.error ?? "Deposit failed.")] });
        }
        break;
      }

      case "withdraw": {
        const amtStr = interaction.options.getString("amount", true);
        const amt = amtStr.toLowerCase() === "all" ? "all" : parseInt(amtStr);
        if (typeof amt === "number" && isNaN(amt)) { await interaction.reply({ embeds: [errorEmbed("Invalid amount.")], ephemeral: true }); return; }
        const result = await withdraw(interaction.guild.id, interaction.user.id, amt);
        if (result.success) {
          await interaction.reply({ embeds: [successEmbed(`Withdrew **${ECONOMY_CURRENCY} ${result.withdrawn?.toLocaleString()}** from your bank.`, "🏦  Withdraw")] });
        } else {
          await interaction.reply({ embeds: [errorEmbed(result.error ?? "Withdraw failed.")] });
        }
        break;
      }

      // ── ANTIRAID ─────────────────────────────────────────────────────────
      case "antiraid": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const sub = interaction.options.getSubcommand();
        if (sub === "enable") {
          const threshold = interaction.options.getInteger("threshold") ?? 8;
          const interval = interaction.options.getInteger("interval") ?? 10;
          await updateGuildSettings(interaction.guild.id, { antiRaidEnabled: true });
          await updateAntiNukeConfig(interaction.guild.id, { antiRaidThreshold: threshold, antiRaidInterval: interval });
          await interaction.reply({
            embeds: [toggleEmbed("🛡️  Anti-Raid", true, [
              { name: "⚠️  Threshold", value: `\`${threshold} joins\``, inline: true },
              { name: "⏱️  Interval", value: `\`${interval}s\``, inline: true },
            ])],
          });
        } else if (sub === "disable") {
          await updateGuildSettings(interaction.guild.id, { antiRaidEnabled: false });
          await interaction.reply({ embeds: [toggleEmbed("🛡️  Anti-Raid", false)] });
        } else if (sub === "lock") {
          await interaction.deferReply({ ephemeral: true });
          await activateLockdown(interaction.guild);
          await interaction.editReply({ embeds: [lockdownEmbed(true)] });
        } else if (sub === "unlock") {
          await interaction.deferReply({ ephemeral: true });
          await deactivateLockdown(interaction.guild);
          await interaction.editReply({ embeds: [lockdownEmbed(false)] });
        }
        break;
      }

      // ── TAGS ─────────────────────────────────────────────────────────────
      case "tag": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const sub = interaction.options.getSubcommand();
        if (sub === "create") {
          const name = interaction.options.getString("name", true).toLowerCase();
          const response = interaction.options.getString("response", true);
          await addCustomCommand(interaction.guild.id, name, response, interaction.user.id);
          await interaction.reply({ embeds: [successEmbed(`Tag \`${name}\` created successfully.`)] });
        } else if (sub === "delete") {
          const name = interaction.options.getString("name", true).toLowerCase();
          await removeCustomCommand(interaction.guild.id, name);
          await interaction.reply({ embeds: [successEmbed(`Tag \`${name}\` deleted.`)] });
        } else if (sub === "list") {
          const cmds = await getCustomCommands(interaction.guild.id);
          await interaction.reply({
            embeds: [infoEmbed("📋  Custom Tags", cmds.length ? cmds.map(c => `> \`${c.trigger}\``).join("\n") : "> *No tags created yet.*")],
          });
        }
        break;
      }

      // ── REACTION ROLES ───────────────────────────────────────────────────
      case "reactionrole": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const sub = interaction.options.getSubcommand();
        if (sub === "add") {
          const msgId = interaction.options.getString("message_id", true);
          const emoji = interaction.options.getString("emoji", true);
          const role = interaction.options.getRole("role", true);
          const mode = interaction.options.getString("mode") ?? "toggle";
          await addReactionRole(interaction.guild.id, interaction.channelId, msgId, emoji, role.id, mode);
          await interaction.reply({ embeds: [successEmbed(`Reaction role added: ${emoji} → <@&${role.id}>`)] });
        } else if (sub === "list") {
          const rrs = await getAllReactionRoles(interaction.guild.id);
          await interaction.reply({
            embeds: [infoEmbed("🎭  Reaction Roles", rrs.length ? rrs.map(r => `> ${r.emoji}  →  <@&${r.roleId}>  ·  \`${r.messageId}\``).join("\n") : "> *No reaction roles set.*")],
          });
        }
        break;
      }

      // ── VERIFICATION ─────────────────────────────────────────────────────
      case "verification": {
        if (!requireAdmin(interaction)) { await interaction.reply({ content: "❌ Administrator only.", ephemeral: true }); return; }
        const sub = interaction.options.getSubcommand();
        if (sub === "enable") {
          const ch = interaction.options.getChannel("channel", true);
          const role = interaction.options.getRole("role");
          await updateGuildSettings(interaction.guild.id, {
            verificationEnabled: true,
            verificationChannelId: ch.id,
            verificationRoleId: role?.id ?? null,
          });
          await interaction.reply({
            embeds: [toggleEmbed("🔐  Verification", true, [
              { name: "📢  Channel", value: `<#${ch.id}>`, inline: true },
              ...(role ? [{ name: "🎭  Verified Role", value: `<@&${role.id}>`, inline: true }] : []),
            ])],
          });
        } else if (sub === "disable") {
          await updateGuildSettings(interaction.guild.id, { verificationEnabled: false });
          await interaction.reply({ embeds: [toggleEmbed("🔐  Verification", false)] });
        }
        break;
      }

      // ── RECOVER ──────────────────────────────────────────────────────────
      case "recover": {
        if (!await requireTrusted(interaction)) {
          await interaction.reply({ embeds: [errorEmbed("Only trusted users or owners can use recovery.")], ephemeral: true }); return;
        }
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply();

        if (sub === "snapshot") {
          await captureSnapshot(interaction.guild);
          await interaction.editReply({ embeds: [successEmbed("Snapshot taken of the current server state.", "📸  Snapshot Updated")] });
          break;
        }

        const settings = await getGuildSettings(interaction.guild.id);
        if (!settings.snapshotData) {
          await interaction.editReply({ embeds: [errorEmbed("No snapshot found. Use `/recover snapshot` first to save the current server state.", "❌  No Snapshot")] });
          break;
        }

        const snapshot = settings.snapshotData as unknown as {
          channels: Array<{ id: string; name: string }>;
          roles: Array<{ id: string; name: string }>;
          capturedAt: number;
        };

        const doChannels = sub === "channels" || sub === "all";
        const doRoles = sub === "roles" || sub === "all";

        let restoredChannels = 0;
        let restoredRoles = 0;

        if (doChannels) {
          for (const ch of snapshot.channels) {
            if (!interaction.guild.channels.cache.has(ch.id)) {
              await recoverDeletedChannel(interaction.guild, ch.id);
              restoredChannels++;
            }
          }
        }

        if (doRoles) {
          for (const role of snapshot.roles) {
            if (!interaction.guild.roles.cache.has(role.id)) {
              await recoverDeletedRole(interaction.guild, role.id);
              restoredRoles++;
            }
          }
        }

        const snapshotAge = Math.floor((Date.now() - snapshot.capturedAt) / 60000);
        const lines: string[] = [];
        if (doChannels) lines.push(`**Channels restored:** \`${restoredChannels}\``);
        if (doRoles) lines.push(`**Roles restored:** \`${restoredRoles}\``);
        lines.push(`**Snapshot age:** \`${snapshotAge}m ago\``);

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(restoredChannels + restoredRoles > 0 ? 0x57f287 : 0x5865f2)
            .setTitle("Recovery Complete")
            .setDescription(lines.join("\n"))
            .setFooter({ text: "Shonargaon Antinuke  ·  Recovery", iconURL: BRAND.icon ?? undefined })
            .setTimestamp()],
        });
        break;
      }

      // ── PROTECT ──────────────────────────────────────────────────────────
      case "protect": {
        if (!await requireTrusted(interaction)) { await interaction.reply({ content: "❌ Trusted users only.", ephemeral: true }); return; }
        const target = interaction.options.getUser("user", true);
        await interaction.deferReply({ ephemeral: true });

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) { await interaction.editReply("❌ User not found in server."); return; }

        let role = interaction.guild.roles.cache.find(r => r.name === UNBYPSSABLE_ROLE_NAME);
        if (!role) {
          role = await interaction.guild.roles.create({
            name: UNBYPSSABLE_ROLE_NAME,
            color: 0xf39c12,
            hoist: false,
            mentionable: false,
            reason: "Guardian Bot — Unbypssable Role",
          });
        }

        await member.roles.add(role, "Shonargaon Antinuke — Protected");
        await setUnbypssableRole(interaction.guild.id, target.id, role.id);
        await interaction.editReply({ embeds: [successEmbed(`<@${target.id}> is now protected with **${UNBYPSSABLE_ROLE_NAME}**.`)] });
        break;
      }

      default:
        await interaction.reply({ content: "❌ Unknown command.", ephemeral: true });
    }
  } catch (err) {
    logger.error({ err, command: commandName }, "Command error");
    const msg = "❌ An error occurred. Please try again.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
}
