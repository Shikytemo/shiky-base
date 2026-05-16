import fs from "fs";

const FILE = "./database/settings.json";

const DEFAULTS = {
  autoread: true,
  autotyping: false,
  antispam: true,
  gamemode: true,
  welcome: false,
  selfmode: false,
};

let _data = { ...DEFAULTS };

function load() {
  try {
    if (fs.existsSync(FILE)) {
      _data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, "utf-8")) };
    }
  } catch { _data = { ...DEFAULTS }; }
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(_data, null, 2));
}

load();

const botSettings = {
  get(key) { return _data[key] ?? DEFAULTS[key]; },
  set(key, val) { _data[key] = val; save(); },
  toggle(key) { _data[key] = !_data[key]; save(); return _data[key]; },
  all() { return { ...DEFAULTS, ..._data }; },
  reset() { _data = { ...DEFAULTS }; save(); },
};

export { botSettings, DEFAULTS };
export default botSettings;