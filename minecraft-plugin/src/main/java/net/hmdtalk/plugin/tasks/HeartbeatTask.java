package net.hmdtalk.plugin.tasks;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.hmdtalk.plugin.HmdMinecraftPlugin;
import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitRunnable;

public class HeartbeatTask extends BukkitRunnable {

    private final HmdMinecraftPlugin plugin;

    public HeartbeatTask(HmdMinecraftPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public void run() {
        if (!plugin.isPaired()) return;

        // Calculate TPS & Memory
        double tps = 20.0;
        try {
            double[] recentTps = Bukkit.getTPS();
            if (recentTps != null && recentTps.length > 0) {
                tps = Math.min(20.0, recentTps[0]);
            }
        } catch (Throwable ignored) {
            // Paper specific getTPS fallback
        }

        Runtime runtime = Runtime.getRuntime();
        long totalMemory = runtime.totalMemory() / (1024 * 1024);
        long freeMemory = runtime.freeMemory() / (1024 * 1024);
        long usedMemory = totalMemory - freeMemory;
        long maxMemory = runtime.maxMemory() / (1024 * 1024);

        JsonObject response = plugin.getApiClient().sendHeartbeat(tps, usedMemory, maxMemory);
        if (response == null) return;

        // Process pending console commands from HMD Talk Admin Space
        if (response.has("commands") && response.get("commands").isJsonArray()) {
            JsonArray commands = response.getAsJsonArray("commands");
            for (JsonElement cmdElement : commands) {
                if (cmdElement.isJsonObject()) {
                    JsonObject cmdObj = cmdElement.getAsJsonObject();
                    String commandStr = cmdObj.get("command").getAsString();
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        plugin.getLogger().info("[HMD Talk Admin] Exécution commande: " + commandStr);
                        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), commandStr);
                    });
                }
            }
        }

        // Process pending messages from HMD Talk to Minecraft chat
        if (response.has("outboundChat") && response.get("outboundChat").isJsonArray()) {
            JsonArray chatList = response.getAsJsonArray("outboundChat");
            String prefix = plugin.getConfig().getString("chat_prefix", "§d[HMD Talk] §r");
            for (JsonElement chatElem : chatList) {
                if (chatElem.isJsonObject()) {
                    JsonObject msgObj = chatElem.getAsJsonObject();
                    String author = msgObj.get("author").getAsString();
                    String content = msgObj.get("content").getAsString();
                    String formatted = prefix + "§b" + author + "§7: §f" + content;
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        Bukkit.broadcastMessage(formatted);
                    });
                }
            }
        }
    }
}
