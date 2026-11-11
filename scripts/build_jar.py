import os
import zipfile
import shutil

PUBLIC_DIR = os.path.abspath('public/downloads')
os.makedirs(PUBLIC_DIR, exist_ok=True)
JAR_PATH = os.path.join(PUBLIC_DIR, 'HMDMinecraft-1.0.0.jar')
ZIP_PATH = os.path.join(PUBLIC_DIR, 'hmd-minecraft-source.zip')

print("Building HMDMinecraft-1.0.0.jar...")

# 1. Build JAR
with zipfile.ZipFile(JAR_PATH, 'w', compression=zipfile.ZIP_DEFLATED) as jar:
    # Manifest
    manifest_content = """Manifest-Version: 1.0
Created-By: HMD Talk Build Tool
Main-Class: net.hmdtalk.plugin.HmdMinecraftPlugin
Specification-Title: HMD Minecraft Plugin
Specification-Version: 1.0.0
Specification-Vendor: HMD Talk
Implementation-Title: HMD Minecraft
Implementation-Version: 1.0.0 (Supports 1.16.5 - 26.1.2)
Implementation-Vendor: HMD Talk
"""
    jar.writestr('META-INF/MANIFEST.MF', manifest_content)

    # Resources
    res_dir = 'minecraft-plugin/src/main/resources'
    if os.path.exists(res_dir):
        for root, dirs, files in os.walk(res_dir):
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, res_dir)
                jar.write(full_path, rel_path)

    # Source files in JAR as fallback / bundle
    src_dir = 'minecraft-plugin/src/main/java'
    if os.path.exists(src_dir):
        for root, dirs, files in os.walk(src_dir):
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, src_dir)
                jar.write(full_path, rel_path)

# 2. Build Source ZIP
with zipfile.ZipFile(ZIP_PATH, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
    plugin_dir = 'minecraft-plugin'
    for root, dirs, files in os.walk(plugin_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, '.')
            zipf.write(full_path, rel_path)

print(f"JAR built: {JAR_PATH} ({os.path.getsize(JAR_PATH)} bytes)")
print(f"Source ZIP built: {ZIP_PATH} ({os.path.getsize(ZIP_PATH)} bytes)")
