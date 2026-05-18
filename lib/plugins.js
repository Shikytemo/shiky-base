import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import log from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.join(__dirname, "..", "plugins");

class PluginManager {
  constructor() {
    this.plugins = {};
  }

  async load() {
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(PLUGINS_DIR).filter(file => file.endsWith(".js"));
    
    for (const file of files) {
      const filePath = path.join(PLUGINS_DIR, file);
      try {
        const plugin = await import(`../plugins/${file}?update=${Date.now()}`);
        if (plugin.default) {
          const name = file.replace(".js", "");
          this.plugins[name] = plugin.default;
        }
      } catch (err) {
        log.error(`Failed to load plugin ${file}: ${err.message}`);
      }
    }
    log.info(`Loaded ${Object.keys(this.plugins).length} plugins.`);
  }

  get(command) {
    for (const name in this.plugins) {
      const p = this.plugins[name];
      if (p.command.includes(command)) {
        return p;
      }
    }
    return null;
  }

  getAll() {
    return Object.values(this.plugins);
  }
}

const plugins = new PluginManager();
export default plugins;
