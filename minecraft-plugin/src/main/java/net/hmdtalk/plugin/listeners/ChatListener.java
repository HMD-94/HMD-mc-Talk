package net.hmdtalk.plugin.listeners;

import net.hmdtalk.plugin.HmdMinecraftPlugin;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;

public class ChatListener implements Listener {

    private final HmdMinecraftPlugin plugin;

    public ChatListener(HmdMinecraftPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent event) {
        if (!plugin.isPaired()) return;
        if (!plugin.getConfig().getBoolean("sync_in_game_chat", true)) return;

        Player player = event.getPlayer();
        String message = event.getMessage();

        // Forward to HMD Talk backend
        plugin.getApiClient().sendChat(player.getName(), player.getUniqueId().toString(), message);
    }
}
