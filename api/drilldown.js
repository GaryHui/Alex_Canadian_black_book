export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await fetchDrilldown({
      year: req.query.year,
      make: req.query.make,
      model: req.query.model,
      series: req.query.series,
      country: req.query.country || "C"
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Server error" });
  }
}

const BASE_URL = process.env.BLACKBOOK_BASE_URL || "https://service.canadianblackbook.com";
const API_PATH = process.env.BLACKBOOK_API_PATH || "/UsedCarWS/CanUsedAPI";

async function fetchDrilldown(input) {
  const year = String(input.year || "").trim();
  if (!year) return { ok: false, error: "Year is required" };

  const username = process.env.BLACKBOOK_USERNAME;
  const password = process.env.BLACKBOOK_PASSWORD;
  if (!username || !password || password === "your_api_password_or_key") {
    return { ok: true, source: "mock", ...mockDrilldown(input) };
  }

  const segments = ["Drilldown", "ALL", year, input.make]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map(encodeURIComponent);
  const endpoint = new URL(`${BASE_URL}${API_PATH}/${segments.join("/")}`);
  endpoint.searchParams.set("drilldeep", "false");
  endpoint.searchParams.set("getclass", "false");
  endpoint.searchParams.set("country", input.country || "C");
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

  return { ok: true, source: "blackbook", ...normalizeDrilldown(json, input), raw: json };
}

function normalizeDrilldown(raw, input = {}) {
  const selectedMake = String(input.make || "").trim();
  const selectedModel = cleanUnknown(input.model);
  const selectedSeries = cleanUnknown(input.series);
  const makeNodes = collectListItems(raw, "make_list");
  const activeMakeNodes = selectedMake
    ? makeNodes.filter((node) => sameName(node?.name, selectedMake))
    : makeNodes;
  const modelNodes = activeMakeNodes.flatMap((make) => arrayOf(make?.model_list));
  const activeModelNodes = selectedModel
    ? modelNodes.filter((node) => sameName(node?.name, selectedModel))
    : [];
  const seriesNodes = activeModelNodes.flatMap((model) => arrayOf(model?.series_list));
  const activeSeriesNodes = selectedSeries
    ? seriesNodes.filter((node) => sameName(node?.name, selectedSeries))
    : seriesNodes;
  const styleNodes = activeSeriesNodes.flatMap((seriesItem) => arrayOf(seriesItem?.style_list));

  const makes = selectedMake
    ? uniqueSorted(activeMakeNodes.map((item) => item?.name))
    : uniqueSorted(makeNodes.map((item) => item?.name));
  const models = uniqueSorted(modelNodes.map((item) => item?.name));
  const series = selectedModel ? uniqueSorted(seriesNodes.map((item) => item?.name)) : [];
  const styles = selectedModel ? uniqueSorted(styleNodes.map((item) => item?.name)) : [];
  const vehicles = selectedModel
    ? styleNodes.map((style) => ({
      uvc: style.uvc || "",
      title: [input.year, selectedMake, selectedModel, selectedSeries || "", style.name || ""].filter(Boolean).join(" "),
      year: String(input.year || ""),
      make: selectedMake,
      model: selectedModel,
      series: selectedSeries || "",
      style: style.name || ""
    }))
    : [];

  return {
    year: String(input.year || ""),
    makes,
    models,
    series,
    styles,
    vehicles
  };
}

function collectListItems(value, listKey, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectListItems(item, listKey, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;

  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === listKey) output.push(...arrayOf(child));
    collectListItems(child, listKey, output);
  }
  return output;
}

function arrayOf(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function sameName(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function cleanUnknown(value) {
  const text = String(value || "").trim();
  return /^not sure$/i.test(text) ? "" : text;
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function mockDrilldown(input = {}) {
  const year = String(input.year || new Date().getFullYear());
  const makes = ["Honda", "Lexus", "Tesla", "Toyota"];
  const modelsByMake = {
    Honda: ["Accord", "Civic", "CR-V", "Odyssey"],
    Lexus: ["ES-Series", "IS-Series", "NX-Series", "RX-Series"],
    Tesla: ["Model 3", "Model S", "Model X", "Model Y"],
    Toyota: ["Camry", "Corolla", "Highlander", "RAV4"]
  };
  const make = String(input.make || "").trim();
  return {
    year,
    makes,
    models: make ? modelsByMake[make] || [] : [],
    series: [],
    styles: [],
    vehicles: []
  };
}
