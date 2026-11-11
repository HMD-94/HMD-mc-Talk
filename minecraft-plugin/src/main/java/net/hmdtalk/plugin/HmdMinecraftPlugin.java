package net.hmdtalk.plugin;

import net.hmdtalk.plugin.commands.HmdCommand;
import net.hmdtalk.plugin.commands.PairCommand;
import net.hmdtalk.plugin.listeners.ChatListener;
import net.hmdtalk.plugin.listeners.PlayerListener;
import net.hmdtalk.plugin.network.HmdApiClient;
import net.hmdtalk.plugin.tasks.HeartbeatTask;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.logging.Level;

public class HmdMinecraftPlugin extends JavaPlugin {

    private static HmdMinecraftPlugin instance;
    private HmdApiClient apiClient;
    private HeartbeatTask heartbeatTask;

    @Override
    public void onEnable() {
        instance = this;
        saveDefaultConfig();

        getLogger().info("==========================================");
        getLogger().info(" HMD Talk Minecraft Plugin v1.0.0");
        getLogger().info(" Chargement du module de communication...");
        getLogger().info("==========================================");

        this.apiClient = new HmdApiClient(this);

        // Register commands
        if (getCommand("pair") != null) {
            getCommand("pair").setExecutor(new PairCommand(this));
        }
        if (getCommand("hmd") != null) {
            getCommand("hmd").setExecutor(new HmdCommand(this));
        }

        // Register listeners
        getServer().getPluginManager().registerEvents(new ChatListener(this), this);
        getServer().getPluginManager().registerEvents(new PlayerListener(this), this);

        // Start periodic heartbeat task
        int intervalSeconds = getConfig().getInt("heartbeat_interval", 5);
        if (intervalSeconds < 2) intervalSeconds = 2;
        long periodTicks = intervalSeconds * 20L;

        this.heartbeatTask = new HeartbeatTask(this);
        this.heartbeatTask.runTaskTimerAsynchronously(this, 60L, periodTicks);

        String token = getConfig().getString("server_token", "");
        if (token == null || token.isEmpty()) {
            getLogger().warning("Le serveur n'est pas encore associé à un groupe HMD Talk.");
            getLogger().warning("Exécutez /pair <CODE> pour connecter ce serveur !");
        } else {
            getLogger().info("Serveur lié au groupe HMD avec succès.");
        }
    }

    @Override
    public void onDisable() {
        if (this.heartbeatTask != null) {
            this.heartbeatTask.cancel();
        }
        getLogger().info("HMD Talk Plugin arrêté.");
    }

    public static HmdMinecraftPlugin getInstance() {
        return instance;
    }

    public HmdApiClient getApiClient() {
        return apiClient;
    }

    public boolean isPaired() {
        String token = getConfig().getString("server_token", "");
        return token != null && !token.trim().isEmpty();
    }

    public void setPaired(String token, String groupId) {
        getConfig().set("server_token", token);
        getConfig().set("group_id", groupId);
        saveConfig();
    }

    public void unlink() {
        getConfig().set("server_token", "");
        getConfig().set("group_id", "");
        saveConfig();
    }
}
