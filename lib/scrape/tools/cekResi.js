import axios from "axios";
import { load } from "cheerio";
import FormData from "form-data";
import CryptoJS from "crypto-js";

function createTimers(resi) {
  const key = CryptoJS.enc.Hex.parse("79540e250fdb16afac03e19c46dbdeb3");
  const iv = CryptoJS.enc.Hex.parse("eb2bb9425e81ffa942522e4414e95bd0");
  const encrypted = CryptoJS.AES.encrypt(resi, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return encrypted.toString();
}

const EKSPEDSI = {
  "shopee-express": "SPX", "ninja": "NINJA", "lion-parcel": "LIONPARCEL",
  "pos-indonesia": "POS", "tiki": "TIKI", "acommerce": "ACOMMERCE",
  "gtl-goto-logistics": "GTL", "paxel": "PAXEL", "sap-express": "SAP",
  "indah-logistik-cargo": "INDAH", "lazada-express-lex": "LEX",
  "lazada-logistics": "LEL", "janio-asia": "JANIO", "jet-express": "JETEXPRESS",
  "pcp-express": "PCP", "pt-ncs": "NCS", "nss-express": "NSS",
  "grab-express": "GRAB", "rcl-red-carpet-logistics": "RCL", "qrim-express": "QRIM",
  "ark-xpress": "ARK", "standard-express-lwe": "LWE", "luar-negeri-bea-cukai": "BEACUKAI",
  "jne": "JNE", "jnt": "JNT", "sicepat": "SICEPAT", "anteraja": "ANTERAJA",
  "wahana": "WAHANA", "dhl": "DHL", "fedex": "FEDEX", "ups": "UPS",
};

// ─── Cek Resi ───
// Check package tracking status
export async function cekResi(noresi, ekspedisi) {
  try {
    if (!noresi) throw new Error("Nomor resi diperlukan");
    const ekspedisiKey = ekspedisi?.toLowerCase().replace(/\s+/g, "-");
    if (!EKSPEDSI[ekspedisiKey]) {
      const available = Object.keys(EKSPEDSI).join(", ");
      throw new Error(`Ekspedisi tidak ditemukan. Tersedia: ${available}`);
    }

    const { data: html } = await axios.get("https://cekresi.com/");
    const $ = load(html);
    const timers = createTimers(noresi.toUpperCase().replace(/\s/g, ""));

    const form = new FormData();
    form.append("viewstate", $('input[name="viewstate"]').attr("value"));
    form.append("secret_key", $('input[name="secret_key"]').attr("value"));
    form.append("e", EKSPEDSI[ekspedisiKey]);
    form.append("noresi", noresi.toUpperCase().replace(/\s/g, ""));
    form.append("timers", timers);

    const { data } = await axios.post(
      `https://apa2.cekresi.com/cekresi/resi/initialize.php?ui=e0ad7e971ce77822056ba7a155f85c11&p=1&w=${Math.random().toString(36).substring(7)}`,
      form,
      {
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          referer: "https://cekresi.com/",
          origin: "https://cekresi.com",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
        },
      }
    );

    const $r = load(data);
    const alertSuccess = $r(".alert.alert-success");

    if (alertSuccess.length > 0) {
      const result = {
        success: true,
        resi: noresi,
        ekspedisi: $r("#nama_expedisi").text().trim() || ekspedisiKey,
        status: "",
        tanggalKirim: "",
        history: [],
      };

      $r("table.table-striped tbody tr").each((i, el) => {
        const cells = $r(el).find("td");
        if (cells.length >= 3) {
          const label = $r(cells[0]).text().trim();
          const value = $r(cells[2]).text().trim();
          if (label === "Tanggal Pengiriman") result.tanggalKirim = value;
          if (label === "Status") result.status = value;
        }
      });

      $r("h4:contains('History')").next("table").find("tbody tr").each((i, el) => {
        const cells = $r(el).find("td");
        if (cells.length >= 2 && i > 0) {
          const tanggal = $r(cells[0]).text().trim();
          const keterangan = $r(cells[1]).text().trim();
          if (tanggal && keterangan) result.history.push({ tanggal, keterangan });
        }
      });

      return result;
    }

    const alertError = $r(".alert.alert-danger, .alert.alert-warning");
    return {
      success: false,
      message: alertError.length > 0 ? alertError.text().trim() : "Tidak dapat mengambil informasi resi",
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
