// Eurostat API configuration
const EUROSTAT_BASE =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

// Product codes mapping to our categories
export const PRODUKT_MAPPING: Record<
  string,
  { code: string; name: string; kategorie: string }
> = {
  "203000": { code: "203000", name: "Dünger (gesamt)", kategorie: "Duenger" },
  "203110": { code: "203110", name: "Stickstoffdünger (KAS)", kategorie: "Duenger" },
  "203120": { code: "203120", name: "Kalkdünger (Carbokalk)", kategorie: "Duenger" },
  "203130": { code: "203130", name: "Kalidünger (Kieserit)", kategorie: "Duenger" },
};

export const PRODUKT_MAPPING_OUTPUT: Record<string, string> = {
  WH_SOFT: "Weizen",
  RYE: "Roggen",
  OATS: "Hafer",
  MAIZE: "Körnermais",
  RAPE: "Raps",
  SOY: "Soja",
  SUNFL: "Sonnenblumen",
  C0000: "Getreide (gesamt)",
  D0000: "Ölsaaten",
};

// German agricultural output price label patterns to match against Eurostat labels
const LABEL_MAPPING: Record<string, { code: string; name: string }> = {
  // Match against Eurostat label strings (lowercased)
  'wheat': { code: 'WH_SOFT', name: 'Weizen' },
  'weizen': { code: 'WH_SOFT', name: 'Weizen' },
  'weichweizen': { code: 'WH_SOFT', name: 'Weizen' },
  'soft wheat': { code: 'WH_SOFT', name: 'Weizen' },
  'rye': { code: 'RYE', name: 'Roggen' },
  'roggen': { code: 'RYE', name: 'Roggen' },
  'oats': { code: 'OATS', name: 'Hafer' },
  'hafer': { code: 'OATS', name: 'Hafer' },
  'maize': { code: 'MAIZE', name: 'Körnermais' },
  'mais': { code: 'MAIZE', name: 'Körnermais' },
  'grain maize': { code: 'MAIZE', name: 'Körnermais' },
  'rapeseed': { code: 'RAPE', name: 'Raps' },
  'raps': { code: 'RAPE', name: 'Raps' },
  'rape': { code: 'RAPE', name: 'Raps' },
  'soybean': { code: 'SOY', name: 'Soja' },
  'soja': { code: 'SOY', name: 'Soja' },
  'soy': { code: 'SOY', name: 'Soja' },
  'sunflower': { code: 'SUNFL', name: 'Sonnenblumen' },
  'sonnenblumen': { code: 'SUNFL', name: 'Sonnenblumen' },
  'cereals': { code: 'C0000', name: 'Getreide (gesamt)' },
  'getreide': { code: 'C0000', name: 'Getreide (gesamt)' },
  'oilseed': { code: 'D0000', name: 'Ölsaaten' },
  'oilseeds': { code: 'D0000', name: 'Ölsaaten' },
  'ölsaaten': { code: 'D0000', name: 'Ölsaaten' },
};

export interface ProduktNode {
  code: string;
  name: string;
  dataset: "apri_pi15_inq" | "apri_pi15_outq";
  children?: ProduktNode[];
  isGroup?: boolean;
}

export const PRODUKT_BAUM: ProduktNode[] = [
  {
    code: "betriebsmittel",
    name: "Betriebsmittelpreise",
    dataset: "apri_pi15_inq",
    isGroup: true,
    children: [
      {
        code: "203000",
        name: "Dünger (gesamt)",
        dataset: "apri_pi15_inq",
        children: [
          { code: "203110", name: "Stickstoffdünger (KAS)", dataset: "apri_pi15_inq" },
          { code: "203120", name: "Kalkdünger (Carbokalk)", dataset: "apri_pi15_inq" },
          { code: "203130", name: "Kalidünger (Kieserit)", dataset: "apri_pi15_inq" },
        ],
      },
    ],
  },
  {
    code: "erzeuger",
    name: "Erzeugerpreise (Index)",
    dataset: "apri_pi15_outq",
    isGroup: true,
    children: [
      {
        code: "C0000",
        name: "Getreide",
        dataset: "apri_pi15_outq",
        children: [
          { code: "WH_SOFT", name: "Weizen", dataset: "apri_pi15_outq" },
          { code: "RYE", name: "Roggen", dataset: "apri_pi15_outq" },
          { code: "OATS", name: "Hafer", dataset: "apri_pi15_outq" },
          { code: "MAIZE", name: "Körnermais", dataset: "apri_pi15_outq" },
        ],
      },
      {
        code: "D0000",
        name: "Ölsaaten & Leguminosen",
        dataset: "apri_pi15_outq",
        children: [
          { code: "RAPE", name: "Raps", dataset: "apri_pi15_outq" },
          { code: "SOY", name: "Soja", dataset: "apri_pi15_outq" },
          { code: "SUNFL", name: "Sonnenblumen", dataset: "apri_pi15_outq" },
        ],
      },
    ],
  },
];

const PRODUCT_CODES = Object.keys(PRODUKT_MAPPING);

export interface EurostatEntry {
  produktCode: string;
  produktName: string;
  zeitraum: string;
  indexWert: number;
}

/**
 * Build the Eurostat API URL for a given dataset and parameters.
 */
function buildUrl(dataset: string, sinceYear: number): string {
  const productParams = PRODUCT_CODES.map(
    (code) => `product=${code}`
  ).join("&");

  return `${EUROSTAT_BASE}/${dataset}?format=JSON&geo=DE&unit=I15&p_adj=NI&${productParams}&sinceTimePeriod=${sinceYear}`;
}

/**
 * Parse JSON-stat response from Eurostat.
 *
 * The JSON-stat format for these datasets has dimensions:
 *   freq, p_adj, unit, product, geo, time
 *
 * Since freq, p_adj, unit, and geo each have size 1, the flat value index is:
 *   index = (product_position * time_count) + time_position
 *
 * The `value` object uses string keys (the flat index) mapped to numeric values.
 */
function parseJsonStat(
  json: Record<string, unknown>,
  dataset: string
): EurostatEntry[] {
  const results: EurostatEntry[] = [];

  // Navigate to the dataset within the response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = json;

  // Some responses wrap in dataset key, some don't
  if (json.id && json.dimension) {
    data = json;
  } else if (json.dataset) {
    data = (json as Record<string, unknown>).dataset;
  } else {
    // Try direct access with dataset name
    const keys = Object.keys(json);
    if (keys.length === 1) {
      data = (json as Record<string, Record<string, unknown>>)[keys[0]];
    }
  }

  const dimensions = data.dimension as Record<string, unknown> | undefined;
  if (!dimensions) {
    console.warn("Eurostat: keine Dimensionsdaten gefunden");
    return results;
  }

  // Extract product dimension positions
  const productDim = dimensions.product as {
    category: { index: Record<string, number>; label?: Record<string, string> };
  };
  if (!productDim?.category?.index) {
    console.warn("Eurostat: keine product-Dimension gefunden");
    return results;
  }
  const productIndex = productDim.category.index;

  // Extract time dimension positions
  const timeDim = dimensions.time as {
    category: { index: Record<string, number>; label?: Record<string, string> };
  };
  if (!timeDim?.category?.index) {
    console.warn("Eurostat: keine time-Dimension gefunden");
    return results;
  }
  const timeIndex = timeDim.category.index;
  const timeCount = Object.keys(timeIndex).length;

  // The flat value array/object
  const values = data.value as Record<string, number>;
  if (!values) {
    console.warn("Eurostat: keine Wertdaten gefunden");
    return results;
  }

  // Iterate over all product codes and time periods
  for (const [productCode, productPos] of Object.entries(productIndex)) {
    const mapping = PRODUKT_MAPPING[productCode];
    if (!mapping) continue;

    for (const [timePeriod, timePos] of Object.entries(timeIndex)) {
      const flatIndex = productPos * timeCount + timePos;
      const value = values[String(flatIndex)];

      if (value !== undefined && value !== null) {
        results.push({
          produktCode: productCode,
          produktName: mapping.name,
          zeitraum: timePeriod,
          indexWert: value,
        });
      }
    }
  }

  void dataset; // suppress unused variable warning
  return results;
}

/**
 * Parse JSON-stat response from Eurostat for output price dataset.
 * Uses label-based fuzzy matching to map Eurostat codes to our standard codes,
 * since the actual dimension codes may differ from what we expect.
 */
function parseJsonStatOutput(json: Record<string, unknown>): EurostatEntry[] {
  const results: EurostatEntry[] = [];

  // Navigate to data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = json;
  if (json.id && json.dimension) {
    data = json;
  } else if (json.dataset) {
    data = (json as Record<string, unknown>).dataset;
  } else {
    const keys = Object.keys(json);
    if (keys.length === 1) {
      data = (json as Record<string, Record<string, unknown>>)[keys[0]];
    }
  }

  const dimensions = data.dimension as Record<string, unknown> | undefined;
  if (!dimensions) {
    console.warn("Eurostat Output: keine Dimensionsdaten gefunden");
    return results;
  }

  // Find the product/outputidx dimension - try different names
  const outputDimKey = ['outputidx', 'product', 'indic_ag', 'prc_typ'].find(k => dimensions[k]);
  if (!outputDimKey) {
    console.warn('Eurostat output: no product dimension found. Available:', Object.keys(dimensions));
    return results;
  }

  const outputDim = dimensions[outputDimKey] as {
    category: { index: Record<string, number>; label?: Record<string, string> }
  };

  const timeDim = dimensions.time as {
    category: { index: Record<string, number> }
  };
  if (!timeDim?.category?.index) {
    console.warn("Eurostat Output: keine time-Dimension gefunden");
    return results;
  }

  const outputIndex = outputDim.category.index;
  const outputLabels = outputDim.category.label ?? {};
  const timeIndex = timeDim.category.index;
  const timeCount = Object.keys(timeIndex).length;
  const values = data.value as Record<string, number>;
  if (!values) {
    console.warn("Eurostat Output: keine Wertdaten gefunden");
    return results;
  }

  for (const [rawCode, productPos] of Object.entries(outputIndex)) {
    const rawLabel = outputLabels[rawCode] ?? rawCode;

    // Try to match the label to our known products
    const labelLower = rawLabel.toLowerCase();
    let mappedName = rawLabel; // default: use Eurostat's own label
    let mappedCode = rawCode;  // default: use Eurostat's raw code

    // Check if any of our label patterns match
    for (const [pattern, mapping] of Object.entries(LABEL_MAPPING)) {
      if (labelLower.includes(pattern)) {
        mappedName = mapping.name;
        mappedCode = mapping.code;
        break;
      }
    }

    for (const [timePeriod, timePos] of Object.entries(timeIndex)) {
      const flatIndex = productPos * timeCount + timePos;
      const value = values[String(flatIndex)];
      if (value !== undefined && value !== null) {
        results.push({
          produktCode: mappedCode,
          produktName: mappedName,
          zeitraum: timePeriod,
          indexWert: value,
        });
      }
    }
  }

  return results;
}

/**
 * Fetch quarterly price index data from Eurostat (dataset apri_pi15_inq).
 * Returns parsed entries for Germany, all mapped product codes.
 */
export async function fetchEurostatQuarterly(
  sinceYear: number = 2020
): Promise<EurostatEntry[]> {
  const url = buildUrl("apri_pi15_inq", sinceYear);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(
      `Eurostat API Fehler: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();
  return parseJsonStat(json, "apri_pi15_inq");
}

/**
 * Fetch annual price index data from Eurostat (dataset apri_pi15_ina).
 * Returns parsed entries for Germany, all mapped product codes.
 */
export async function fetchEurostatAnnual(
  sinceYear: number = 2020
): Promise<EurostatEntry[]> {
  const url = buildUrl("apri_pi15_ina", sinceYear);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(
      `Eurostat API Fehler: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();
  return parseJsonStat(json, "apri_pi15_ina");
}

/**
 * Fetch quarterly output price index data from Eurostat (dataset apri_pi15_outq).
 * Uses auto-discovery: fetches all available codes without filtering, then maps
 * them to our standard product codes via label-based fuzzy matching.
 * Fails gracefully if data is unavailable.
 */
export async function fetchEurostatOutput(
  sinceYear: number = 2020
): Promise<EurostatEntry[]> {
  // Step 1: Fetch WITHOUT specifying outputidx codes to get all available codes
  const discoveryUrl = `${EUROSTAT_BASE}/apri_pi15_outq?format=JSON&geo=DE&unit=I15&p_adj=NI&sinceTimePeriod=${sinceYear}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(discoveryUrl, { headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json = await res.json();

    // Parse the response - it should contain an 'outputidx' dimension with available codes
    // The actual codes will be in json.dimension.outputidx.category.index
    return parseJsonStatOutput(json);
  } catch (err) {
    console.warn("fetchEurostatOutput error:", err instanceof Error ? err.message : String(err));
    return [];
  }
}
