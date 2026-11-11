package net.hmdtalk.plugin.network;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.hmdtalk.plugin.HmdMinecraftPlugin;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.logging.Level;

public class HmdApiClient {

    private final HmdMinecraftPlugin plugin;
    private final Gson gson;

    public HmdApiClient(HmdMinecraftPlugin plugin) {
        this.plugin = plugin;
        this.gson = new Gson();
    }

    private String getBaseUrl() {
        String url = plugin.getConfig().getString("backend_url", "http://localhost:3000");
        if (url == null || url.trim().isEmpty()) url = "http://localhost:3000";
        if (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        return url;
    }

    private String getServerToken() {
        return plugin.getConfig().getString("server_token", "");
    }

    /**
     * Authenticate and pair with the backend using temporary pairing code
     */
    public boolean pair(String code, String[] errorHolder) {
        try {
            String endpoint = getBaseUrl() + "/api/minecraft/plugin/pair";
            JsonObject payload = new JsonObject();
            payload.addProperty("code", code.trim().toUpperCase());

            JsonObject serverInfo = new JsonObject();
            serverInfo.addProperty("ip", Bukkit.getIp().isEmpty() ? "127.0.0.1" : Bukkit.getIp());
            serverInfo.addProperty("port", Bukkit.getPort());
            serverInfo.addProperty("version", Bukkit.getVersion());
            serverInfo.addProperty("loader", Bukkit.getName());
            serverInfo.addProperty("motd", Bukkit.getMotd());
            payload.add("serverInfo", serverInfo);

            String response = post(endpoint, payload.toString(), null);
            if (response == null) {
                if (errorHolder != null && errorHolder.length > 0) errorHolder[0] = "Impossible de contacter le serveur HMD.";
                return false;
            }

            JsonObject resJson = JsonParser.parseString(response).getAsJsonObject();
            if (resJson.has("success") && resJson.get("success").getAsBoolean()) {
                String token = resJson.get("serverToken").getAsString();
                String groupId = resJson.get("groupId").getAsString();
                plugin.setPaired(token, groupId);
                return true;
            } else {
                if (errorHolder != null && errorHolder.length > 0 && resJson.has("error")) {
                    errorHolder[0] = resJson.get("error").getAsString();
                }
                return false;
            }
        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Erreur lors du pairage : " + e.getMessage());
            if (errorHolder != null && errorHolder.length > 0) errorHolder[0] = e.getMessage();
            return false;
        }
    }

    /**
     * Send heartbeat and receive pending commands & outbound chat
     */
    public JsonObject sendHeartbeat(double tps, long ramUsedMb, long ramMaxMb) {
        if (!plugin.isPaired()) return null;

        try {
            String endpoint = getBaseUrl() + "/api/minecraft/plugin/heartbeat";
            JsonObject payload = new JsonObject();
            payload.addProperty("tps", tps);
            payload.addProperty("ramUsedMb", ramUsedMb);
            payload.addProperty("ramMaxMb", ramMaxMb);
            payload.addProperty("version", Bukkit.getMinecraftVersion());
            payload.addProperty("motd", Bukkit.getMotd());

            JsonArray playersArray = new JsonArray();
            for (Player p : Bukkit.getOnlinePlayers()) {
                JsonObject pJson = new JsonObject();
                pJson.addProperty("name", p.getName());
                pJson.addProperty("uuid", p.getUniqueId().toString());
                pJson.addProperty("ping", p.getPing());
                pJson.addProperty("health", (int) p.getHealth());
                pJson.addProperty("dimension", p.getWorld().getEnvironment().name().toLowerCase());
                pJson.addProperty("x", Math.round(p.getLocation().getX()));
                pJson.addProperty("y", Math.round(p.getLocation().getY()));
                pJson.addProperty("z", Math.round(p.getLocation().getZ()));
                pJson.addProperty("yaw", Math.round(p.getLocation().getYaw()));
                pJson.addProperty("pitch", Math.round(p.getLocation().getPitch()));
                playersArray.add(pJson);
            }
            payload.add("players", playersArray);

            String response = post(endpoint, payload.toString(), getServerToken());
            if (response != null) {
                return JsonParser.parseString(response).getAsJsonObject();
            }
        } catch (Exception e) {
            // Heartbeat failed
        }
        return null;
    }

    /**
     * Send chat message from Minecraft to HMD Talk
     */
    public void sendChat(String author, String uuid, String message) {
        if (!plugin.isPaired()) return;

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                String endpoint = getBaseUrl() + "/api/minecraft/plugin/chat";
                JsonObject payload = new JsonObject();
                payload.addProperty("author", author);
                payload.addProperty("uuid", uuid);
                payload.addProperty("message", message);

                post(endpoint, payload.toString(), getServerToken());
            } catch (Exception e) {
                plugin.getLogger().warning("Erreur transmission chat: " + e.getMessage());
            }
        });
    }

    /**
     * Send event notice (join, quit, death) to HMD Talk
     */
    public void sendEvent(String type, String player, String message) {
        if (!plugin.isPaired()) return;

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                String endpoint = getBaseUrl() + "/api/minecraft/plugin/events";
                JsonObject payload = new JsonObject();
                payload.addProperty("type", type);
                payload.addProperty("player", player);
                payload.addProperty("message", message);

                post(endpoint, payload.toString(), getServerToken());
            } catch (Exception e) {
                // Ignore transient event fail
            }
        });
    }

    private String post(String urlString, String jsonBody, String token) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        conn.setRequestProperty("User-Agent", "HMD-Minecraft-Plugin/1.0.0");
        conn.setConnectTimeout(6000);
        conn.setReadTimeout(6000);
        conn.setDoOutput(true);

        if (token != null && !token.isEmpty()) {
            conn.setRequestProperty("X-HMD-Server-Token", token);
        }

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }

        int code = conn.getResponseCode();
        BufferedReader reader;
        if (code >= 200 && code < 300) {
            reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
        } else {
            if (conn.getErrorStream() != null) {
                reader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8));
            } else {
                return null;
            }
        }

        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            response.append(line);
        }
        reader.close();
        return response.toString();
    }
}
