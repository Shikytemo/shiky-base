import { fetchHtml } from "../utils.js";

// ─── Weather/Cuaca Scraper ───
// Primary: wttr.in JSON API (reliable, no JS, no blocking)
// Fallback: Google weather (often blocks on Termux)
export async function cuaca(kota) {
  try {
    const html = await fetchHtml(`https://wttr.in/${encodeURIComponent(kota)}?format=j1`, {
      headers: { "User-Agent": "curl/7.88.1" },
    });
    const data = typeof html === "string" ? JSON.parse(html) : html;
    const current = data.current_condition?.[0];
    if (!current) return { success: false, error: `Cuaca untuk "${kota}" tidak ditemukan.` };

    const area = data.nearest_area?.[0]?.areaName?.[0]?.value || kota;
    const country = data.nearest_area?.[0]?.country?.[0]?.value || "";
    const location = country ? `${area}, ${country}` : area;

    // Forecast (next 2 days)
    const forecast = (data.weather || []).slice(1, 3).map(d => ({
      day: d.date || "",
      hi: d.maxtempC || "?",
      lo: d.mintempC || "?",
      desc: d.hourly?.[4]?.weatherDesc?.[0]?.value || "",
    }));

    return {
      success: true,
      location,
      temperature: `${current.temp_C}°C`,
      condition: current.weatherDesc?.[0]?.value || current.lang_id?.[0]?.value || null,
      humidity: `${current.humidity}%`,
      wind: `${current.windspeedKmph} km/h`,
      feelsLike: `${current.FeelsLikeC}°C`,
      forecast: forecast.length ? forecast : null,
    };
  } catch (e) {
    return { success: false, error: `Cuaca untuk "${kota}" tidak ditemukan.` };
  }
}
