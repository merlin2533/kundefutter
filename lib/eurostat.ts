// Eurostat API configuration
const EUROSTAT_BASE =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

// Product codes mapping to our categories
export const PRODUKT_MAPPING: Record<
  string,
  { code: string; name: string; kategorie: string }
> = {
  "201000": { code: "201000", name: "Saatgut", kategorie: "Saatgut" },
  "203000": { code: "203000", name: "Dünger (gesamt)", kategorie: "Duenger" },
  "203100": { code: "203100", name: "Einzeldünger", kategorie: "Duenger" },
  "203110": { code: "203110", name: "Stickstoffdünger", kategorie: "Duenger" },
  "203120": { code: "203120", name: "Phosphatdünger", kategorie: "Duenger" },
  "203130": { code: "203130", name: "Kalidünger", kategorie: "Duenger" },
  "203200": { code: "203200", name: "Mischdünger", kategorie: "Duenger" },
  "206000": {
    code: "206000",
    name: "Futtermittel (gesamt)",
    kategorie: "Futter",
  },
  "206100": {
    code: "206100",
    name: "Einzelfuttermittel",
    kategorie: "Futter",
  },
  "206200": {
    code: "206200",
    name: "Mischfuttermittel",
    kategorie: "Futter",
  },
};

export const PRODUKT_MAPPING_OUTPUT: Record<string, string> = {
  C0000: "Getreide (gesamt)",
  C1110: "Weichweizen",
  C1120: "Roggen",
  C1130: "Gerste",
  C1140: "Hafer",
  C1150: "Körnermais",
  D0000: "Ölsaaten",
  D1100: "Raps",
  D1200: "Sonnenblumen",
  D1300: "Soja",
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
          {
            code: "203100",
            name: "Einzeldünger",
            dataset: "apri_pi15_inq",
            children: [
              { code: "203110", name: "Stickstoffdünger", dataset: "apri_pi15_inq" },
              { code: "203120", name: "Phosphatdünger", dataset: "apri_pi15_inq" },
              { code: "203130", name: "Kalidünger", dataset: "apri_pi15_inq" },
            ],
          },
          { code: "203200", name: "Mischdünger", dataset: "apri_pi15_inq" },
        ],
      },
      { code: "201000", name: "Saatgut", dataset: "apri_pi15_inq" },
      {
        code: "206000",
        name: "Futtermittel (gesamt)",
        dataset: "apri_pi15_inq",
        children: [
          { code: "206100", name: "Einzelfuttermittel", dataset: "apri_pi15_inq" },
          { code: "206200", name: "Mischfuttermittel", dataset: "apri_pi15_inq" },
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
        name: "Getreide (gesamt)",
        dataset: "apri_pi15_outq",
        children: [
          { code: "C1110", name: "Weichweizen", dataset: "apri_pi15_outq" },
          { code: "C1120", name: "Roggen", dataset: "apri_pi15_outq" },
          { code: "C1130", name: "Gerste", dataset: "apri_pi15_outq" },
          { code: "C1140", name: "Hafer", dataset: "apri_pi15_outq" },
          { code: "C1150", name: "Körnermais", dataset: "apri_pi15_outq" },
        ],
      },
      {
        code: "D0000",
        name: "Ölsaaten",
        dataset: "apri_pi15_outq",
        children: [
          { code: "D1100", name: "Raps", dataset: "apri_pi15_outq" },
          { code: "D1300", name: "Soja", dataset: "apri_pi15_outq" },
          { code: "D1200", name: "Sonnenblumen", dataset: "apri_pi15_outq" },
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
 * Similar to parseJsonStat but uses 'product' dimension for output codes.
 */
function parseJsonStatOutput(
  json: Record<string, unknown>,
  codes: string[]
): EurostatEntry[] {
  const results: EurostatEntry[] = [];

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

  // Try outputidx dimension first, then fall back to product
  const outputDim = (dimensions.outputidx ?? dimensions.product) as {
    category: { index: Record<string, number>; label?: Record<string, string> };
  } | undefined;
  if (!outputDim?.category?.index) {
    console.warn("Eurostat Output: keine outputidx/product-Dimension gefunden");
    return results;
  }
  const outputIndex = outputDim.category.index;

  const timeDim = dimensions.time as {
    category: { index: Record<string, number>; label?: Record<string, string> };
  };
  if (!timeDim?.category?.index) {
    console.warn("Eurostat Output: keine time-Dimension gefunden");
    return results;
  }
  const timeIndex = timeDim.category.index;
  const timeCount = Object.keys(timeIndex).length;

  const values = data.value as Record<string, number>;
  if (!values) {
    console.warn("Eurostat Output: keine Wertdaten gefunden");
    return results;
  }

  for (const [productCode, productPos] of Object.entries(outputIndex)) {
    if (!codes.includes(productCode)) continue;
    const name = PRODUKT_MAPPING_OUTPUT[productCode];
    if (!name) continue;

    for (const [timePeriod, timePos] of Object.entries(timeIndex)) {
      const flatIndex = productPos * timeCount + timePos;
      const value = values[String(flatIndex)];

      if (value !== undefined && value !== null) {
        results.push({
          produktCode: productCode,
          produktName: name,
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

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

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

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

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
 * Returns parsed entries for Germany, all mapped output product codes.
 * Fails gracefully if data is unavailable.
 */
export async function fetchEurostatOutput(
  sinceYear: number = 2020
): Promise<EurostatEntry[]> {
  const codes = [
    "C0000",
    "C1110",
    "C1120",
    "C1130",
    "C1140",
    "C1150",
    "D0000",
    "D1100",
    "D1200",
    "D1300",
  ];
  const params = codes.map((c) => `outputidx=${c}`).join("&");
  const url = `${EUROSTAT_BASE}/apri_pi15_outq?format=JSON&geo=DE&unit=I15&p_adj=NI&${params}&sinceTimePeriod=${sinceYear}`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json();
    return parseJsonStatOutput(json, codes);
  } catch {
    return [];
  }
}
