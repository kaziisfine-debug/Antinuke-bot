import { Client, ActivityType } from "discord.js";
import { registerCommands } from "../commands/index.js";
import { captureSnapshot } from "../systems/recovery.js";
import { resumeGiveaways } from "../systems/giveaway.js";
import { ensureGuild } from "../database.js";
import { logger } from "../../lib/logger.js";

export async function onReady(client: Client): Promise<void> {
  logger.info({ tag: client.user?.tag, guilds: client.guilds.cache.size }, "Bot is ready");

  client.user?.setPresence({
    activities: [{ name: "⚡ Protecting servers", type: ActivityType.Watching }],
    status: "online",
  });

  await registerCommands(client);
  await resumeGiveaways(client);

  // Snapshot all guilds for recovery
  for (const guild of client.guilds.cache.values()) {
    await ensureGuild(guild.id).catch(() => {});
    await captureSnapshot(guild).catch(() => {});
  }

  // Periodic snapshot update every 10 minutes
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      await captureSnapshot(guild).catch(() => {});
    }
  }, 10 * 60 * 1000);

  // Maintain unbypssable roles every 2 minutes
  setInterval(async () => {
    const { getAllUnbypssableRoles } = await import("../database.js");
    for (const guild of client.guilds.cache.values()) {
      try {
        const protected_ = await getAllUnbypssableRoles(guild.id);
        for (const p of protected_) {
          const member = await guild.members.fetch(p.userId).catch(() => null);
          if (!member) continue;
          if (!member.roles.cache.has(p.roleId)) {
            const role = guild.roles.cache.get(p.roleId);
            if (role) await member.roles.add(role, "Guardian — Unbypssable role maintenance").catch(() => {});
          }
        }
      } catch {}
    }
  }, 2 * 60 * 1000);
}
