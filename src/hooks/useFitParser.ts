import { useState } from "react";
import FitParser from "fit-file-parser";

interface FitSession {
  start_time?: Date;
  total_distance?: number;
  total_elapsed_time?: number;
  total_timer_time?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  avg_cadence?: number;
  total_ascent?: number;
  total_descent?: number;
  avg_power?: number;
  max_power?: number;
  sport?: string;
  sub_sport?: string;
}

interface FitData {
  sessions?: FitSession[];
  laps?: any[];
  records?: any[];
}

const mapFitSport = (fitSport: string, fitSubSport?: string): string => {
  const sport = fitSport?.toLowerCase();
  const subSport = fitSubSport?.toLowerCase();

  if (sport === "cycling") {
    if (subSport === "mountain_boot" || subSport === "mountain")
      return "mountain_biking";
    if (subSport === "gravel") return "gravel";
    return "cycling";
  }

  if (sport === "running") {
    if (subSport === "track" || subSport === "indoor_cycling")
      return "track_athletics";
    if (subSport === "trail") return "trail";
    return "running";
  }

  if (sport === "fitness_equipment" || sport === "strength")
    return "strength_training";
  if (sport === "walking") return "walking";

  return sport || "other";
};

export const useFitParser = () => {
  const [isParsing, setIsParsing] = useState(false);

  const parseFitFile = async (file: File): Promise<any> => {
    setIsParsing(true);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;

        const fitParser = new FitParser({
          force: true,
          speedUnit: "m/s",
          lengthUnit: "m",
          temperatureUnit: "celsius",
        });

        fitParser.parse(arrayBuffer, (error: any, data: any) => {
          if (error) {
            console.error("Erreur de parsing FIT:", error);
            setIsParsing(false);
            reject(error);
          } else {
            const fitData = data as FitData;
            const session = fitData.sessions?.[0] || {};
            console.log("Session complète:", session);
            // pour débug : affiche l'entièreté des données globale du fichier fit

            // --- CRÉATION DES STREAMS (Format Strava) ---
            const streams = {
              time: [] as number[],
              latlng: [] as (number[] | null)[],
              altitude: [] as (number | null)[],
              heartrate: [] as (number | null)[],
              watts: [] as (number | null)[],
            };

            if (fitData.records && fitData.records.length > 0) {
              // On cherche le vrai temps de départ (pour calculer les secondes écoulées)
              const startTimeMs = session.start_time
                ? new Date(session.start_time).getTime()
                : new Date(fitData.records[0].timestamp).getTime();

              fitData.records.forEach((record: any) => {
                if (!record.timestamp) return;

                // 1. Calcul du temps écoulé en secondes
                const currentMs = new Date(record.timestamp).getTime();
                const elapsedS = Math.round((currentMs - startTimeMs) / 1000);

                // On évite les valeurs négatives si le fichier est mal structuré
                if (elapsedS < 0) return;

                streams.time.push(elapsedS);

                // 2. Coordonnées GPS (lat, lng)
                if (
                  record.position_lat !== undefined &&
                  record.position_long !== undefined
                ) {
                  streams.latlng.push([
                    record.position_lat,
                    record.position_long,
                  ]);
                } else {
                  streams.latlng.push(null); // Crucial pour garder les tableaux synchronisés
                }

                // 3. Altitude
                if (record.altitude !== undefined) {
                  streams.altitude.push(Math.round(record.altitude * 10) / 10);
                } else {
                  streams.altitude.push(null);
                }

                // 4. Fréquence cardiaque
                if (record.heart_rate !== undefined) {
                  streams.heartrate.push(record.heart_rate);
                } else {
                  streams.heartrate.push(null);
                }
                // 5. Puissance
                if (record.power !== undefined) {
                  streams.watts.push(record.power);
                } else {
                  streams.watts.push(null);
                }
              });
            }

            // --- CRÉATION DES LAPS (Standardisé) ---
            const formattedLaps = (fitData.laps || []).map(
              (lap: any, index: number) => ({
                name: `Tour ${index + 1}`,
                split: index + 1,
                distance_m: Math.round(lap.total_distance || 0),
                total_duration_s: Math.round(lap.total_elapsed_time || 0),
                moving_time_s: Math.round(lap.total_timer_time || 0),
                avg_heart_rate: lap.avg_heart_rate || null,
                max_heart_rate: lap.max_heart_rate || null,
                avg_power: lap.avg_power ? Math.round(lap.avg_power) : null,
                max_power: lap.max_power ? Math.round(lap.max_power) : null,
                elevation_gain_m: Math.round(lap.total_ascent || 0),
                elevation_loss_m: Math.round(lap.total_descent || 0),
              }),
            );
            let maxPower = session.max_power || null;

            // Si le max est absent de la session mais qu'on a des points de puissance
            if (!maxPower && streams.watts && streams.watts.length > 0) {
              // On filtre les null et on cherche le chiffre le plus haut
              const powerPoints = streams.watts.filter(
                (p): p is number => p !== null,
              );
              if (powerPoints.length > 0) {
                maxPower = Math.max(...powerPoints);
              }
            }
            // ---------------------------------------------

            const activityData = {
              title: "Nouvelle activité",
              sport: mapFitSport(session.sport ?? "unknown", session.sub_sport),
              started_at: session.start_time || new Date(),
              total_distance_m: Math.round(session.total_distance || 0),
              total_duration_s: Math.round(session.total_elapsed_time || 0),
              moving_time_s: Math.round(session.total_timer_time || 0),
              avg_heart_rate: session.avg_heart_rate
                ? Math.round(session.avg_heart_rate)
                : null,
              max_heart_rate: session.max_heart_rate
                ? Math.round(session.max_heart_rate)
                : null,
              avg_cadence: session.avg_cadence
                ? Math.round(session.avg_cadence)
                : null,
              elevation_gain_m: Math.round(session.total_ascent || 0),
              elevation_loss_m: Math.round(session.total_descent || 0),
              avg_power: session.avg_power
                ? Math.round(session.avg_power)
                : null,
              max_power: maxPower ? Math.round(maxPower) : null, // On utilise notre variable calculée

              laps: formattedLaps,
              streams: streams, // On passe nos beaux tableaux à la place des records bruts !
            };

            setIsParsing(false);
            resolve(activityData);
          }
        });
      };

      reader.onerror = () => {
        setIsParsing(false);
        reject(new Error("Erreur lors de la lecture du fichier"));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  return { parseFitFile, isParsing };
};
