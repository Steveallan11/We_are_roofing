import { NextResponse } from "next/server";
import { fetchWeatherForecast } from "@/lib/weather/openMeteo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location") || "Yateley";

  try {
    const forecast = await fetchWeatherForecast(location);
    return NextResponse.json({ ok: true, forecast });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Weather lookup failed." },
      { status: 500 }
    );
  }
}
