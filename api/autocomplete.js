export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await fetchAutocomplete(req.query.searchText || "");
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Server error" });
  }
}

const BASE_URL = process.env.BLACKBOOK_BASE_URL || "https://service.canadianblackbook.com";
const API_PATH = process.env.BLACKBOOK_API_PATH || "/UsedCarWS/CanUsedAPI";

async function fetchAutocomplete(searchText) {
  const query = String(searchText || "").trim();
  if (query.length < 2) return { ok: true, items: [] };

  const username = process.env.BLACKBOOK_USERNAME;
  const password = process.env.BLACKBOOK_PASSWORD;
  if (!username || !password || password === "your_api_password_or_key") {
    return { ok: true, source: "mock", items: mockAutocomplete(query) };
  }

  const endpoint = new URL(`${BASE_URL}${API_PATH}/Autocomplete`);
  endpoint.searchParams.set("searchText", query);
  endpoint.searchParams.set("country", "C");
  endpoint.searchParams.set("customerid", "test");

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`
    }
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, error: `Black Book API returned ${response.status}`, raw: json };
  }

  return { ok: true, source: "blackbook", items: normalizeAutocomplete(json), raw: json };
}

function normalizeAutocomplete(raw) {
  const arrays = [];
  collectArrays(raw, arrays);
  const best = arrays.sort((a, b) => b.length - a.length)[0] || [];
  return best
    .filter((item) => item && typeof item === "object")
    .slice(0, 20)
    .map((item) => ({
      uvc: item.uvc || item.UVC || item.value || "",
      year: item.model_year || item.year || "",
      make: item.make || "",
      model: item.model || "",
      series: item.series || item.trim || "",
      style: item.style || "",
      title: item.description || item.vehicle_description || item.text || vehicleTitle(item)
    }))
    .filter((item) => item.title && item.title !== "Vehicle ");
}

function collectArrays(value, arrays) {
  if (Array.isArray(value)) {
    arrays.push(value);
    value.forEach((item) => collectArrays(item, arrays));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectArrays(item, arrays));
  }
}

function vehicleTitle(vehicle = {}) {
  const year = vehicle.model_year || vehicle.year;
  const make = vehicle.make;
  const model = vehicle.model;
  const series = vehicle.series || vehicle.trim;
  const style = vehicle.style;
  const parts = [year, make, model, series, style].filter(Boolean);
  return parts.length ? parts.join(" ") : "";
}

function mockAutocomplete(query) {
  return [
    {
      uvc: "2017080342",
      year: "2017",
      make: "Honda",
      model: "Odyssey",
      series: "LX",
      style: "4D Wagon",
      title: "2017 Honda Odyssey LX 4D Wagon"
    }
  ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase().split(/\s+/).at(-1) || ""));
}
