import { fetchPage, cleanText } from "../utils.js";

// ─── Currency/Kurs Scraper ───
// Primary: x-rates.com (reliable, no JS needed)
// Fallback: Google Finance
export async function kurs(from = "USD", to = "IDR") {
  try {
    from = from.toUpperCase();
    to = to.toUpperCase();
    return await kursXrates(from, to);
  } catch (e) {
    return { success: false, error: "Gagal ambil kurs." };
  }
}

// x-rates.com — reliable table-based rates
async function kursXrates(from, to) {
  const $ = await fetchPage(`https://www.x-rates.com/table/?from=${from}&to=${to}`);
  let rate = null;
  $("table.ratesTable tbody tr").each((i, el) => {
    if (rate) return;
    const cells = $(el).find("td");
    const currency = cleanText(cells.eq(0).text());
    // Match by currency name containing the target code or common name
    const toLower = to.toLowerCase();
    const currencyMap = {
      "idr": ["indonesian rupiah", "idr"],
      "eur": ["euro", "eur"],
      "gbp": ["british pound", "gbp"],
      "jpy": ["japanese yen", "jpy"],
      "krw": ["south korean won", "krw"],
      "myr": ["malaysian ringgit", "myr"],
      "sgd": ["singapore dollar", "sgd"],
      "thb": ["thai baht", "thb"],
      "cny": ["chinese yuan renminbi", "cny"],
      "aud": ["australian dollar", "aud"],
      "cad": ["canadian dollar", "cad"],
      "chf": ["swiss franc", "chf"],
      "inr": ["indian rupee", "inr"],
      "php": ["philippine peso", "php"],
      "vnd": ["vietnamese dong", "vnd"],
      "brl": ["brazilian real", "brl"],
      "mxn": ["mexican peso", "mxn"],
      "try": ["turkish lira", "try"],
      "rub": ["russian ruble", "rub"],
      "sar": ["saudi riyal", "sar"],
      "aed": ["u.a.e. dirham", "aed"],
      "nzd": ["new zealand dollar", "nzd"],
      "sek": ["swedish krona", "sek"],
      "nok": ["norwegian krone", "nok"],
      "dkk": ["danish krone", "dkk"],
      "zar": ["south african rand", "zar"],
      "hkd": ["hong kong dollar", "hkd"],
      "twd": ["taiwan new dollar", "twd"],
      "pln": ["polish zloty", "pln"],
    };
    const matchNames = currencyMap[toLower] || [toLower];
    const currencyLower = currency.toLowerCase();
    if (matchNames.some(m => currencyLower.includes(m))) {
      rate = cleanText(cells.eq(1).text());
    }
  });

  if (!rate) return { success: false, error: "Gagal ambil kurs." };

  const numRate = parseFloat(rate.replace(/,/g, ""));
  return {
    success: true,
    from,
    to,
    rate: numRate || rate,
    text: `1 ${from} = ${rate} ${to}`,
    updated: new Date().toLocaleDateString("id-ID"),
  };
}

// Convert amount
export async function currencyConvert(amount, from, to) {
  const result = await kurs(from, to);
  if (!result.success) return result;
  const num = parseFloat(amount) * result.rate;
  return {
    ...result,
    amount: parseFloat(amount),
    converted: num.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    text: `${amount} ${from} = ${num.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${to}`,
  };
}
