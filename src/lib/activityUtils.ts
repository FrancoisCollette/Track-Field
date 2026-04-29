// Classification des sports
export const SPORT_UNITS = {
  PACE: ["running", "trail", "track_athletics", "walking", "hiking"],
  SWIM: ["swimming", "open_water_swimming"],
  SPEED: [
    "cycling",
    "mountain_biking",
    "gravel",
    "ebike",
    "ski_alpine",
    "ski_nordic",
    "snowboard",
    "sailing",
    "stand_up_paddling",
    "kayaking",
  ],
};

export type SpeedMode = "PACE" | "SWIM" | "SPEED";

// Détermine l'unité à utiliser
export const getSpeedMode = (sport: string): SpeedMode => {
  const s = sport?.toLowerCase();
  if (SPORT_UNITS.PACE.includes(s)) return "PACE";
  if (SPORT_UNITS.SWIM.includes(s)) return "SWIM";
  return "SPEED";
};

// Formate le temps (ex: 01:20:30)
export const formatDuration = (seconds: number) => {
  if (!seconds) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}h${m.toString().padStart(2, "0")}'${s.toString().padStart(2, "0")}"`
    : `${m}'${s.toString().padStart(2, "0")}"`;
};

// La fonction "Magique" pour la vitesse/allure
export const formatActivitySpeed = (
  speedMps: number | undefined | null,
  sport: string,
) => {
  if (!speedMps || speedMps < 0.1) return "--";

  const mode = getSpeedMode(sport);

  if (mode === "PACE") {
    const paceSeconds = 1000 / speedMps;
    const m = Math.floor(paceSeconds / 60);
    const s = Math.round(paceSeconds % 60);
    return `${m}'${s.toString().padStart(2, "0")}" /km`;
  }

  if (mode === "SWIM") {
    const paceSeconds = 100 / speedMps;
    const m = Math.floor(paceSeconds / 60);
    const s = Math.round(paceSeconds % 60);
    return `${m}'${s.toString().padStart(2, "0")} /100m`;
  }

  return `${(speedMps * 3.6).toFixed(1)} km/h`;
};

// Pour l'affichage de l'unité seule (ex: "/km" ou "km/h")
export const getSpeedUnit = (sport: string) => {
  const mode = getSpeedMode(sport);
  if (mode === "PACE") return "/km";
  if (mode === "SWIM") return "/100m";
  return "km/h";
};

/**
 * Calcule la vitesse moyenne (ou allure) à partir d'une distance et d'un temps,
 * puis la formate en faisant appel à formatActivitySpeed.
 */
export const calculateAndFormatSpeed = (
  distance_m: number,
  time_s: number,
  sport: string,
): string => {
  if (!time_s || time_s === 0) return "--";
  const speedMps = distance_m / time_s;
  return formatActivitySpeed(speedMps, sport);
};

/**
 * Récupère les streams depuis le Worker (R2), et les formate
 * pour le graphique (Recharts) et la carte (Mapbox).
 */
export const fetchActivityStreams = async (
  activityId: string,
  token: string,
  workerUrl: string,
) => {
  const response = await fetch(`${workerUrl}/activity/${activityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      "Erreur lors de la récupération des streams depuis le Worker",
    );
  }

  const fullJson = await response.json();
  const streams = fullJson.streams || {};

  let chartData: any[] = [];
  let coordinates: number[][] = [];

  if (streams.time) {
    // 1. Formatage pour Recharts
    chartData = streams.time.map((t: number, i: number) => {
      const latlng = streams.latlng ? streams.latlng[i] : null;
      const distance = streams.distance ? streams.distance[i] : 0;
      const speed = streams.velocity_smooth
        ? streams.velocity_smooth[i] * 3.6
        : 0; // Stocké en km/h pour le graphe
      const alt = streams.altitude ? streams.altitude[i] : null;
      const hr = streams.heartrate ? streams.heartrate[i] : null;
      const pwr = streams.watts ? streams.watts[i] : null;

      return {
        time: t,
        distance: (distance / 1000).toFixed(2),
        speed: speed,
        altitude: alt,
        heartRate: hr,
        power: pwr,
        latlng: latlng,
      };
    });

    // 2. Formatage pour Mapbox [longitude, latitude]
    if (streams.latlng) {
      coordinates = streams.latlng
        .filter((p: any) => p !== null && Array.isArray(p) && p.length >= 2)
        .map((p: number[]) => [p[1], p[0]]);
    }
  }

  return { chartData, coordinates };
};
