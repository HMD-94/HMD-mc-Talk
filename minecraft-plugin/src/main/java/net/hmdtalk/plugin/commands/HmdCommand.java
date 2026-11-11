package net.hmdtalk.plugin.commands;

import net.hmdtalk.plugin.HmdMinecraftPlugin;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;

public class HmdCommand implements CommandExecutor {

    private final HmdMinecraftPlugin plugin;

    public HmdCommand(HmdMinecraftPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("hmd.admin")) {
            sender.sendMessage("§c[HMD Talk] Permission requise : hmd.admin");
            return true;
        }

        if (args.length == 0 || args[0].equalsIgnoreCase("help")) {
            sender.sendMessage("§d--- [HMD Talk Commandes] ---");
            sender.sendMessage("§e/pair <CODE> §7- Associer le serveur à un groupe HMD");
            sender.sendMessage("§e/hmd status §7- Voir le statut de la connexion");
            sender.sendMessage("§e/hmd chat <message> §7- Envoyer un message vers HMD Talk");
            sender.sendMessage("§e/hmd unlink §7- Dissocier ce serveur de HMD Talk");
            sender.sendMessage("§e/hmd reload §7- Recharger config.yml");
            return true;
        }

        String sub = args[0].toLowerCase();
        switch (sub) {
            case "status":
                sender.sendMessage("§d[HMD Talk] Statut du serveur :");
                sender.sendMessage("§7Lié : " + (plugin.isPaired() ? "§aOui ✔" : "§cNon ✖"));
                sender.sendMessage("§7Backend URL : §f" + plugin.getConfig().getString("backend_url"));
                sender.sendMessage("§7Groupe ID : §f" + plugin.getConfig().getString("group_id", "Aucun"));
                break;

            case "unlink":
                if (!plugin.isPaired()) {
                    sender.sendMessage("§c[HMD Talk] Ce serveur n'est pas lié.");
                    return true;
                }
                plugin.unlink();
                sender.sendMessage("§a[HMD Talk] Le serveur a été dissocié de HMD Talk.");
                break;

            case "reload":
                plugin.reloadConfig();
                sender.sendMessage("§a[HMD Talk] Configuration rechargée.");
                break;

            case "chat":
                if (args.length < 2) {
                    sender.sendMessage("§cUtilisation : /hmd chat <message>");
                    return true;
                }
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i < args.length; i++) {
                    sb.append(args[i]).append(" ");
                }
                plugin.getApiClient().sendChat(sender.getName(), "console", sb.toString().trim());
                sender.sendMessage("§a[HMD Talk] Message envoyé au groupe HMD Talk !");
                break;

            default:
                sender.sendMessage("§cCommande inconnue. Tapez /hmd help");
                break;
        }

        return true;
    }
}
