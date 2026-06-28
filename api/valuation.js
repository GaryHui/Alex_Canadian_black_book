export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await fetchValuation(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Server error" });
  }
}

const BASE_URL = process.env.BLACKBOOK_BASE_URL || "https://service.canadianblackbook.com";
const API_PATH = process.env.BLACKBOOK_API_PATH || "/UsedCarWS/CanUsedAPI";
const VALUATION_TEMPLATE = process.env.BLACKBOOK_TEMPLATE || "12";

async function fetchValuation(input) {
  const vin = cleanVin(input.vin);
  const uvc = String(input.uvc || "").trim();
  const year = String(input.year || "").trim();
  const make = String(input.make || "").trim();
  const model = cleanUnknown(input.model);
  const series = cleanUnknown(input.series);
  const style = cleanUnknown(input.style);
  const kilometers = Number(input.kilometers || input.mileage || 0);
  const region = String(input.region || "ON").trim();
  const country = String(input.country || "C").trim();
  const language = String(input.language || "en").trim();

  if (!vin && !uvc && !(year && make)) throw new Error("VIN, UVC, or vehicle description is required");
  if (!Number.isFinite(kilometers) || kilometers <= 500) throw new Error("Please enter an odometer value greater than 500 km");

  const username = process.env.BLACKBOOK_USERNAME;
  const password = process.env.BLACKBOOK_PASSWORD;

  if (!username || !password || password === "your_api_password_or_key") {
    return buildDemoResponse(input, mockBlackBookResponse(vin, kilometers, region, country));
  }

  const endpoint = valuationEndpoint({ vin, uvc, year, make });
  endpoint.searchParams.set("country", country);
  endpoint.searchParams.set("language", language);
  endpoint.searchParams.set("customerid", input.customerid || "test");
  if (VALUATION_TEMPLATE) endpoint.searchParams.set("template", VALUATION_TEMPLATE);
  if (region) endpoint.searchParams.set("state", region);
  if (kilometers > 0) endpoint.searchParams.set("mileage", String(kilometers));
  if (model) endpoint.searchParams.set("model", model);
  if (series) endpoint.searchParams.set("series", series);
  if (style) endpoint.searchParams.set("style", style);

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
    return {
      ok: false,
      source: "blackbook",
      status: response.status,
      error: `Black Book API returned ${response.status}`,
      raw: json
    };
  }

  return buildDemoResponse(input, json);
}

function valuationEndpoint({ vin, uvc, year, make }) {
  if (uvc) return new URL(`${BASE_URL}${API_PATH}/UsedVehicle/UVC/${encodeURIComponent(uvc)}`);
  if (year && make) return new URL(`${BASE_URL}${API_PATH}/UsedVehicle/${encodeURIComponent(year)}/${encodeURIComponent(make)}`);
  return new URL(`${BASE_URL}${API_PATH}/UsedVehicle/VIN/${encodeURIComponent(vin)}`);
}

function buildDemoResponse(input, raw) {
  const vehicles = allVehicles(raw);
  const vehicle = chooseVehicle(vehicles, input) || firstVehicle(raw);
  if (!hasVehicleData(vehicle)) {
    return {
      ok: false,
      source: raw?.mock ? "mock" : "blackbook",
      error: "No vehicle matches found. Please search and choose a specific vehicle first.",
      choices: [],
      raw
    };
  }

  const values = extractValues(vehicle);
  const chargeable = hasChargeableValuationValues(values);
  const title = vehicleTitle(vehicle, input.vin);
  const vin = cleanVin(input.vin) || vehicle?.vin;
  const kilometers = Number(input.kilometers || input.mileage || 0);
  const regionCode = String(input.region || "ON").trim();

  return {
    ok: true,
    source: raw?.mock ? "mock" : "blackbook",
    title,
    vin,
    kilometers,
    region: regionName(regionCode),
    country: String(input.country || "C").trim(),
    optionsSelected: 0,
    activeMarket: "wholesale",
    columns: ["xclean", "clean", "avg", "rough"],
    values,
    chargeable,
    noChargeReason: chargeable ? "" : "Canadian Black Book did not return usable market pricing for this vehicle, so this lookup will not use one of your annual valuations.",
    loanValue: findNumber(vehicle, ["loan_value", "finadv", "adjusted_finadv", "finance_advance_value"]),
    thresholds: vehicle?.kilometer_adjustments || null,
    choices: vehicles.length > 1 ? vehicles.map(vehicleChoice) : [],
    raw
  };
}

function allVehicles(raw) {
  const candidates = [
    raw?.used_vehicles?.used_vehicle_list,
    raw?.used_vehicle?.used_vehicles,
    raw?.used_vehicle?.usedvehicles,
    raw?.usedvehicles?.usedvehicles,
    raw?.usedvehicles,
    raw?.used_vehicles,
    raw?.vehicle_list,
    raw?.vehicles
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") return [candidate];
  }

  return raw?.vehicle ? [raw.vehicle] : [];
}

function chooseVehicle(vehicles, input) {
  if (!vehicles.length) return null;
  const uvc = String(input.uvc || "").trim();
  if (uvc) return vehicles.find((vehicle) => String(vehicle.uvc || "") === uvc) || vehicles[0];
  return vehicles[0];
}

function vehicleChoice(vehicle) {
  return {
    uvc: vehicle.uvc || "",
    title: vehicleTitle(vehicle),
    year: vehicle.model_year || vehicle.year || "",
    make: vehicle.make || "",
    model: vehicle.model || "",
    series: vehicle.series || "",
    style: vehicle.style || "",
    adjustedWholesaleAvg: findMarketNumber(vehicle, ["adjusted"], ["whole"], "avg"),
    adjustedRetailAvg: findMarketNumber(vehicle, ["adjusted"], ["retail"], "avg")
  };
}

function firstVehicle(raw) {
  const candidates = [
    raw?.used_vehicles?.used_vehicle_list,
    raw?.used_vehicles?.used_vehicle_list,
    raw?.used_vehicle?.used_vehicles,
    raw?.used_vehicle?.usedvehicles,
    raw?.usedvehicles?.usedvehicles,
    raw?.usedvehicles,
    raw?.used_vehicles,
    raw?.vehicle_list,
    raw?.vehicles
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate[0];
    if (candidate && typeof candidate === "object") return candidate;
  }

  return raw?.vehicle || raw;
}

function extractValues(vehicle = {}) {
  return {
    wholesale: extractMarket(vehicle, "whole"),
    retail: extractMarket(vehicle, "retail"),
    tradeIn: extractMarket(vehicle, "trade")
  };
}

function hasChargeableValuationValues(values) {
  return ["wholesale", "retail", "tradeIn"].some((market) => {
    const marketData = values?.[market] || {};
    return ["adjusted", "base"].some((rowKey) =>
      Object.values(marketData[rowKey] || {}).some((value) => positiveNumber(value) !== null)
    );
  });
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function extractMarket(vehicle, market) {
  const aliases = market === "trade" ? ["trade", "tradein", "trade_in"] : [market];
  const rowNames = {
    base: ["base"],
    options: ["add_deduct", "options", "option"],
    mileage: ["mileage", "kilometer", "km"],
    region: ["regional", "region"],
    adjusted: ["adjusted"]
  };
  const conditions = ["xclean", "clean", "avg", "rough"];
  const output = {};

  for (const [row, prefixes] of Object.entries(rowNames)) {
    output[row] = {};
    for (const condition of conditions) {
      output[row][condition] = findMarketNumber(vehicle, prefixes, aliases, condition);
    }
  }

  return output;
}

function findMarketNumber(vehicle, rowPrefixes, marketAliases, condition) {
  const conditionAliases = condition === "xclean" ? ["xclean", "extra_clean", "xcln"] : [condition];
  const keys = Object.keys(vehicle || {});

  for (const row of rowPrefixes) {
    for (const market of marketAliases) {
      for (const cond of conditionAliases) {
        const exact = `${row}_${market}_${cond}`;
        if (isNumberLike(vehicle[exact])) return Number(vehicle[exact]);
      }
    }
  }

  for (const key of keys) {
    const normalized = key.toLowerCase();
    if (
      rowPrefixes.some((row) => normalized.includes(row)) &&
      marketAliases.some((market) => normalized.includes(market)) &&
      conditionAliases.some((cond) => normalized.includes(cond)) &&
      isNumberLike(vehicle[key])
    ) {
      return Number(vehicle[key]);
    }
  }

  return null;
}

function findNumber(object, keys) {
  for (const key of keys) {
    if (isNumberLike(object?.[key])) return Number(object[key]);
  }
  return null;
}

function isNumberLike(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function vehicleTitle(vehicle = {}, fallbackVin = "") {
  const year = vehicle.model_year || vehicle.year;
  const make = vehicle.make;
  const model = vehicle.model;
  const series = vehicle.series || vehicle.trim;
  const style = vehicle.style || vehicle.body_style;
  const parts = [year, make, model, series, style].filter(Boolean);
  return parts.length ? parts.join(" ") : `Vehicle ${cleanVin(fallbackVin)}`;
}

function cleanVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanUnknown(value) {
  const text = String(value || "").trim();
  return text.toLowerCase() === "not sure" ? "" : text;
}

function hasVehicleData(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return false;
  if (vehicle.uvc || vehicle.vin || vehicle.model_year || vehicle.year || vehicle.make || vehicle.model) return true;
  const values = extractValues(vehicle);
  return ["wholesale", "retail", "tradeIn"].some((market) =>
    Object.values(values[market] || {}).some((row) =>
      Object.values(row || {}).some((value) => value !== null && value !== undefined)
    )
  );
}

function regionName(code) {
  const regions = {
    AB: "Alberta",
    BC: "British Columbia",
    MB: "Manitoba",
    NB: "New Brunswick",
    NL: "Newfoundland and Labrador",
    NS: "Nova Scotia",
    NT: "Northwest Territories",
    NU: "Nunavut",
    ON: "Ontario",
    PE: "Prince Edward Island",
    QC: "Quebec",
    SK: "Saskatchewan",
    YT: "Yukon"
  };
  return regions[String(code || "").toUpperCase()] || code || "Ontario";
}

function mockBlackBookResponse(vin, kilometers, region, country) {
  return {
    mock: true,
    used_vehicle: {
      used_vehicles: [
        {
          vin,
          model_year: "2024",
          make: "Lexus",
          model: "NX-Series",
          series: "NX350 Premium",
          style: "4D Utility AWD",
          base_whole_xclean: 44200,
          base_whole_clean: 42600,
          base_whole_avg: 40350,
          base_whole_rough: 38200,
          mileage_whole_xclean: 1025,
          mileage_whole_clean: 1550,
          mileage_whole_avg: 2075,
          mileage_whole_rough: 2575,
          regional_whole_xclean: 2652,
          regional_whole_clean: 2556,
          regional_whole_avg: 2421,
          regional_whole_rough: 2292,
          add_deduct_whole_xclean: 0,
          add_deduct_whole_clean: 0,
          add_deduct_whole_avg: 0,
          add_deduct_whole_rough: 0,
          adjusted_whole_xclean: 47877,
          adjusted_whole_clean: 46706,
          adjusted_whole_avg: 44846,
          adjusted_whole_rough: 43067,
          base_retail_xclean: 50100,
          base_retail_clean: 48600,
          base_retail_avg: 46300,
          base_retail_rough: 44100,
          mileage_retail_xclean: 1200,
          mileage_retail_clean: 1700,
          mileage_retail_avg: 2200,
          mileage_retail_rough: 2700,
          regional_retail_xclean: 3006,
          regional_retail_clean: 2916,
          regional_retail_avg: 2778,
          regional_retail_rough: 2646,
          add_deduct_retail_xclean: 0,
          add_deduct_retail_clean: 0,
          add_deduct_retail_avg: 0,
          add_deduct_retail_rough: 0,
          adjusted_retail_xclean: 54306,
          adjusted_retail_clean: 53216,
          adjusted_retail_avg: 51278,
          adjusted_retail_rough: 49446,
          kilometer_adjustments: {
            xclean_km_threshold: 136000,
            clean_km_threshold: 213000,
            avg_km_threshold: 253000,
            rough_km_threshold: 273000,
            cents_per_kilometer: 0.1
          },
          loan_value: 41924,
          region,
          country,
          input_kilometers: kilometers
        }
      ]
    }
  };
}
