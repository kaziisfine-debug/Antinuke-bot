import { Guild, GuildMember, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Interaction, ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { getGuildSettings, setPendingVerification, getPendingVerification, deletePendingVerification, incrementVerificationAttempt } from "../database.js";
import { COLORS } from "../config.js";
import { logger } from "../../lib/logger.js";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function obfuscateCode(code: string): string {
  const map: Record<string, string> = {
    A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М",
    O: "О", P: "Р", S: "Ѕ", T: "Т", X: "Х", Y: "У",
  };
  return code.split("").map(c => (map[c] && Math.random() > 0.4 ? map[c]! : c)).join("");
}

export async function sendVerificationChallenge(member: GuildMember): Promise<void> {
  try {
    const settings = await getGuildSettings(member.guild.id);
    if (!settings.verificationEnabled) return;

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await setPendingVerification(member.guild.id, member.id, code, expiresAt);

    const verifyChannel = settings.verificationChannelId
      ? member.guild.channels.cache.get(settings.verificationChannelId) as TextChannel | undefined
      : null;

    const displayCode = obfuscateCode(code);

    const embed = new EmbedBuilder()
      .setColor(COLORS.blue)
      .setTitle("🔒 Human Verification Required")
      .setDescription(
        `Welcome to **${member.guild.name}**!\n\n` +
        `To gain access, type the code below:\n\n` +
        `\`\`\`${displayCode}\`\`\`\n` +
        `⚠️ You have **5 minutes** and **3 attempts** to verify.\n` +
        `Do **NOT** copy-paste — type the code manually.`
      )
      .setFooter({ text: "Verification • Powered by Guardian" })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`verify:${member.id}`)
        .setLabel("Enter Code")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔑")
    );

    if (verifyChannel) {
      const msg = await verifyChannel.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] });
      setTimeout(async () => {
        msg.delete().catch(() => {});
        await deletePendingVerification(member.guild.id, member.id).catch(() => {});
      }, 5 * 60 * 1000);
    } else {
      await member.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, guildId: member.guild.id, userId: member.id }, "Failed to send verification challenge");
  }
}

export async function handleVerifyButton(interaction: ButtonInteraction): Promise<void> {
  const [, targetId] = interaction.customId.split(":");
  if (interaction.user.id !== targetId) {
    await interaction.reply({ content: "This verification is not for you.", ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`verify_modal:${interaction.user.id}`)
    .setTitle("Enter Verification Code");

  const input = new TextInputBuilder()
    .setCustomId("code")
    .setLabel("Type the code shown (do not copy-paste)")
    .setStyle(TextInputStyle.Short)
    .setMinLength(6)
    .setMaxLength(6)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleVerifyModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) return;

  const [, targetId] = interaction.customId.split(":");
  if (interaction.user.id !== targetId) {
    await interaction.reply({ content: "This verification is not for you.", ephemeral: true });
    return;
  }

  const pending = await getPendingVerification(interaction.guild.id, interaction.user.id);
  if (!pending) {
    await interaction.reply({ content: "❌ No pending verification. Please rejoin the server.", ephemeral: true });
    return;
  }

  if (new Date() > pending.expiresAt) {
    await deletePendingVerification(interaction.guild.id, interaction.user.id);
    await interaction.reply({ content: "❌ Verification expired. Please rejoin.", ephemeral: true });
    return;
  }

  if (pending.attempts >= 3) {
    await deletePendingVerification(interaction.guild.id, interaction.user.id);
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (member) await member.kick("Failed verification - too many attempts").catch(() => {});
    await interaction.reply({ content: "❌ Too many failed attempts. You have been removed.", ephemeral: true });
    return;
  }

  const submitted = interaction.fields.getTextInputValue("code").trim().toUpperCase();

  if (submitted !== pending.code) {
    await incrementVerificationAttempt(interaction.guild.id, interaction.user.id);
    const remaining = 2 - pending.attempts;
    await interaction.reply({ content: `❌ Wrong code. ${remaining} attempt(s) remaining.`, ephemeral: true });
    return;
  }

  await deletePendingVerification(interaction.guild.id, interaction.user.id);

  const settings = await getGuildSettings(interaction.guild.id);
  if (settings.verificationRoleId) {
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (member) {
      await member.roles.add(settings.verificationRoleId, "Passed verification").catch(() => {});
    }
  }

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("✅ Verified!")
      .setDescription(`Welcome to **${interaction.guild.name}**! You now have full access.`)
      .setTimestamp()],
    ephemeral: true,
  });
}
