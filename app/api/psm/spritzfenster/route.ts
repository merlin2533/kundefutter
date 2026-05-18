import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

type Ampel = "gruen" | "gelb" | "rot";

interface SpritzStunde {
  datetime: string;
  temp: number;
  wind: number;
  precipitation: number;
  humidity: number;
  ampel: Ampel;
  gruende: string[];
}

function bewerte(
  temp: number,
  wind: number,
  precipitation: number,
  humidity: number,
  stunde: number,
): { ampel: Ampel; gruende: string[] } {
  const gruende: string[] = [];

  // Immer rot
  if (precipitation >= 0.1) {
    gruende.push(`Niederschlag (${precipitation} mm/h)`);
    return { ampel: "rot", gruende };
  }
  if (wind >= 5) {
    gruende.push(`Wind zu stark (${wind} m/s)`);
    return { ampel: "rot", gruende };
  }
  if (temp < 4 || temp > 30) {
    gruende.push(`Temperatur außerhalb Bereich (${temp}°C)`);
    return { ampel: "rot", gruende };
  }
  if (humidity >= 90) {
    gruende.push(`Luftfeuchte zu hoch (${humidity}%)`);
    return { ampel: "rot", gruende };
  }
  if (stunde >= 6 && stunde <= 9) {
    gruende.push("Bienen-Schutzzeit (6–9 Uhr)");
    return { ampel: "rot", gruende };
  }

  // Bedingt
  if (wind >= 3) {
    gruende.push(`Wind erhöht (${wind} m/s)`);
  }
  if (humidity >= 80) {
    gruende.push(`Luftfeuchte erhöht (${humidity}%)`);
  }
  if (temp < 5 || temp > 25) {
    gruende.push(`Temperatur grenzwertig (${temp}°C)`);
  }

  if (gruende.length > 0) {
    return { ampel: "gelb", gruende };
  }

  return { ampel: "gruen", gruende: ["Bedingungen optimal"] };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat und lng erforderlich" }, { status: 400 });
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,precipitation,windspeed_10m,relativehumidity_2m,weathercode` +
      `&timezone=Europe/Berlin&forecast_days=3`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return NextResponse.json({ error: `Wetter-API Fehler: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const {
      time,
      temperature_2m,
      precipitation,
      windspeed_10m,
      relativehumidity_2m,
    } = data.hourly as {
      time: string[];
      temperature_2m: number[];
      precipitation: number[];
      windspeed_10m: number[];
      relativehumidity_2m: number[];
    };

    const stunden: SpritzStunde[] = time.map((dt: string, i: number) => {
      const temp = Math.round((temperature_2m[i] ?? 0) * 10) / 10;
      const wind = Math.round((windspeed_10m[i] ?? 0) / 3.6 * 10) / 10; // km/h → m/s
      const prec = Math.round((precipitation[i] ?? 0) * 100) / 100;
      const hum = Math.round(relativehumidity_2m[i] ?? 0);
      const stunde = parseInt(dt.slice(11, 13), 10);

      const { ampel, gruende } = bewerte(temp, wind, prec, hum, stunde);

      return { datetime: dt, temp, wind, precipitation: prec, humidity: hum, ampel, gruende };
    });

    return NextResponse.json(stunden);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Wetter-API nicht erreichbar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
