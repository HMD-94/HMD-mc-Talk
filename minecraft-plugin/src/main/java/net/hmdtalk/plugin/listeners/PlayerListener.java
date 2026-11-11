package net.hmdtalk.plugin.listeners;

import net.hmdtalk.plugin.HmdMinecraftPlugin;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

public class PlayerListener implements Listener {

    private final HmdMinecraftPlugin plugin;

    public PlayerListener(HmdMinecraftPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        if (!plugin.isPaired() || !plugin.getConfig().getBoolean("sync_events", true)) return;

        Player player = event.getPlayer();
        plugin.getApiClient().sendEvent(
                "join",
                player.getName(),
                player.getName() + " s'est connecté au serveur Minecraft."
        );
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        if (!plugin.isPaired() || !plugin.getConfig().getBoolean("sync_events", true)) return;

        Player player = event.getPlayer();
        plugin.getApiClient().sendEvent(
                "quit",
                player.getName(),
                player.getName() + " s'est déconnecté du serveur Minecraft."
        );
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onDeath(PlayerDeathEvent event) {
        if (!plugin.isPaired() || !plugin.getConfig().getBoolean("sync_events", true)) return;

        Player player = event.getEntity();
        String deathMsg = event.getDeathMessage() != null ? event.getDeathMessage() : player.getName() + " est mort.";
        plugin.getApiClient().sendEvent(
                "death",
                player.getName(),
                deathMsg
        );
    }
}
