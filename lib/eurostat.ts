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
