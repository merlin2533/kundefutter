export interface WetterTag {
  datum: string;       // "2026-05-09"
  maxTemp: number;     // °C
  minTemp: number;     // °C
  niederschlag: number; // mm
  wetterCode: number;  // WMO Code
  beschreibung: string;
  icon: string;        // Emoji
}

function wetterBeschreibungUndIcon(code: number): { beschreibung: string; icon: string } {
  if (code === 0) return { beschreibung: "Sonnig", icon: "☀️" };
  if (code <= 3) return { beschreibung: "Wolkig", icon: "🌤️" };
  if (code <= 48) return { beschreibung: "Nebel", icon: "🌫️" };
  if (code <= 67) return { beschreibung: "Regen", icon: "🌧️" };
  if (code <= 77) return { beschreibung: "Schnee", icon: "🌨️" };
  if (code <= 82) return { beschreibung: "Schauer", icon: "🌦️" };
  if (code <= 99) return { beschreibung: "Gewitter", icon: "⛈️" };
  return { beschreibung: "Unbekannt", icon: "🌡️" };
}

export async function getWetter5Tage(lat: number, lng: number): Promise<WetterTag[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=Europe%2FBerlin&forecast_days=5`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`OpenMeteo HTTP ${res.status}`);
  }
  const data = await res.json();

  const { time, weathercode, temperature_2m_max, temperature_2m_min, precipitation_sum } =
    data.daily as {
      time: string[];
      weathercode: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
    };

  return time.map((datum: string, i: number) => {
    const code = weathercode[i] ?? 0;
    const { beschreibung, icon } = wetterBeschreibungUndIcon(code);
    return {
      datum,
      maxTemp: Math.round(temperature_2m_max[i] ?? 0),
      minTemp: Math.round(temperature_2m_min[i] ?? 0),
      niederschlag: Math.round((precipitation_sum[i] ?? 0) * 10) / 10,
      wetterCode: code,
      beschreibung,
      icon,
    };
  });
}
