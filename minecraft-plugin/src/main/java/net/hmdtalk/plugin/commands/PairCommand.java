package net.hmdtalk.plugin.commands;

import net.hmdtalk.plugin.HmdMinecraftPlugin;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;

public class PairCommand implements CommandExecutor {

    private final HmdMinecraftPlugin plugin;

    public PairCommand(HmdMinecraftPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("hmd.admin")) {
            sender.sendMessage("§c[HMD Talk] Vous n'avez pas la permission d'associer ce serveur.");
            return true;
        }

        if (args.length < 1) {
            sender.sendMessage("§c[HMD Talk] Utilisation : /pair <CODE>");
            sender.sendMessage("§7Exemple : /pair HMD-8K29-PQ");
            return true;
        }

        String code = args[0].trim().toUpperCase();
        sender.sendMessage("§e[HMD Talk] Vérification du code de jumelage §6" + code + "§e avec HMD Talk...");

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            String[] errorHolder = new String[1];
            boolean success = plugin.getApiClient().pair(code, errorHolder);

            Bukkit.getScheduler().runTask(plugin, () -> {
                if (success) {
                    sender.sendMessage("§a=============================================");
                    sender.sendMessage("§a✔ [HMD Talk] Serveur connecté avec succès !");
                    sender.sendMessage("§7Groupe HMD : §f" + plugin.getConfig().getString("group_id"));
                    sender.sendMessage("§7Le chat, les joueurs et la carte sont synchronisés.");
                    sender.sendMessage("§a=============================================");
                } else {
                    String err = errorHolder[0] != null ? errorHolder[0] : "Code invalide ou expiré.";
                    sender.sendMessage("§c✖ [HMD Talk] Échec de la liaison : §f" + err);
                    sender.sendMessage("§7Vérifiez l'adresse backend dans config.yml et générez un nouveau code sur HMD Talk.");
                }
            });
        });

        return true;
    }
}
