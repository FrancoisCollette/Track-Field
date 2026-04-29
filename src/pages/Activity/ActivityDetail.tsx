import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import mapboxgl from "mapbox-gl"; // Import direct de la bibliothèque de base
import "mapbox-gl/dist/mapbox-gl.css";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import {
  ArrowLeft,
  Timer,
  Ruler,
  TrendingUp,
  Heart,
  Zap,
  Gauge,
  Calendar,
} from "lucide-react";
import {
  formatActivitySpeed,
  getSpeedMode,
  formatDuration,
  calculateAndFormatSpeed,
  fetchActivityStreams,
} from "../../lib/activityUtils";
import "./ActivityDetail.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const WORKER_URL = import.meta.env.VITE_WORKER_URL;

const ActivityDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Références pour manipuler le DOM de la carte
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [chartData, setChartData] = useState<any[]>([]);
  const [activeCurves, setActiveCurves] = useState({
    speed: false,
    altitude: true, // Par défaut, on affiche l'altitude
    heartRate: false,
    power: false,
  });

  // Déterminer si c'est un sport de "Pace" (min/km) ou de "Vitesse" (km/h)
  const isRunningSport = useMemo(() => {
    const s = activity?.sport?.toLowerCase() || "";
    return s.includes("run") || s.includes("trail") || s.includes("walk");
  }, [activity]);

  useEffect(() => {
    if (id) {
      fetchActivityData();
    }
  }, [id]);

  // 2. useEffect pour initialiser la carte quand TOUT est prêt
  useEffect(() => {
    // On ne lance la carte QUE si :
    // - On n'est plus en train de charger
    // - On a les données d'activité
    // - Le container de la carte est présent dans le DOM
    // - La carte n'est pas déjà initialisée
    if (
      !loading &&
      activity &&
      chartData.length > 0 &&
      mapContainer.current &&
      !map.current
    ) {
      // On récupère les coordonnées depuis le chartData ou on les repasse
      // attention inversion [lat, long] vers [long, lat] pour Mapbox
      const coords = chartData
        .filter((d) => d.latlng && d.latlng.length === 2)
        .map((d) => [d.latlng[1], d.latlng[0]]);
      if (coords.length > 0) {
        initMap(coords);
      }
    }
  }, [loading, activity, chartData]); // S'exécute quand l'un de ces trois change

  // 3. useEffect pour le nettoyage (uniquement)
  useEffect(() => {
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const fetchActivityData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Supabase (Datas globales de l'activité)
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      setActivity(data);

      // 2. Fetch Worker (R2)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && id) {
        const { chartData: newChartData } = await fetchActivityStreams(
          id,
          session.access_token,
          WORKER_URL,
        );

        setChartData(newChartData);

        // if (coordinates.length > 0) {
        //   initMap(coordinates);
        // } else {
        //   console.error("Aucune coordonnée valide trouvée pour la carte.");
        // }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const initMap = (coords: number[][]) => {
    // Sécurité si pas de map ou fichier gps vide
    if (!mapContainer.current || map.current || coords.length === 0) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Création de l'instance Mapbox
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: coords[0] as [number, number], // On commence au premier point
      zoom: 12,
      trackResize: true, // Aide Mapbox à se redimensionner sur Vercel
    });

    // Ajout des contrôles
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;

      // Ajout de la source GeoJSON (le tracé)
      map.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        },
      });

      // Ajout de la couche visuelle (la ligne)
      map.current.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#f97911",
          "line-width": 3,
          "line-opacity": 0.9,
          // couleurs de lignes possibles selon notre design :
          // --color-eden:        #105749;
          // --color-ecstasy:     #f97911;
          // --color-mango:       #db7c00;
          // --color-lonestar:    #650901;
          // --color-gossip:      #cbf498;
        },
      });

      // Ajustement automatique du zoom
      const bounds = coords.reduce(
        (acc, coord) => acc.extend(coord as [number, number]),
        new mapboxgl.LngLatBounds(
          coords[0] as [number, number],
          coords[0] as [number, number],
        ),
      );

      map.current.fitBounds(bounds, { padding: 40, duration: 1000 });
    });
  };

  const toggleCurve = (key: keyof typeof activeCurves) => {
    setActiveCurves((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) return <div className="loading-screen">Chargement...</div>;
  if (!activity)
    return <div className="error-screen">Activité introuvable.</div>;

  return (
    <div className="activity-detail-page">
      <header className="detail-header">
        <button onClick={() => navigate(-1)} className="back-btn">
          <ArrowLeft size={20} />
          <span>Retour</span>
        </button>
        <div className="header-spacer1"></div>
        <h1 className="header-title">
          {activity.sport.replace("_", " ") || "Track & Field"}
        </h1>
        <div className="header-spacer2"></div>
      </header>

      <main className="detail-content">
        {/* Titre et date */}
        <section className="hero-card">
          <div className="hero-info">
            <span className="activity-date">
              <Calendar size={16} />
              {new Date(activity.started_at).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <h2>{activity.title.replace("_", " ") || "Données de session"}</h2>
          </div>
        </section>

        {/* Statistiques principales */}
        <div className="stats-grid">
          <div className="stat-card primary">
            <Ruler className="stat-icon" />
            <div className="stat-value">
              {(activity.total_distance_m / 1000).toFixed(2)}
            </div>
            <div className="stat-label">Distance (km)</div>
          </div>
          <div className="stat-card primary">
            <Timer className="stat-icon" />
            <div className="stat-value">
              {formatDuration(activity.moving_time_s)}
            </div>
            <div className="stat-label">Temps</div>
          </div>
          <div className="stat-card primary">
            <TrendingUp className="stat-icon" />
            <div className="stat-value">
              {Math.round(activity.elevation_gain_m)}m
            </div>
            <div className="stat-label">Dénivelé +</div>
          </div>
          <div className="stat-card primary">
            <Gauge className="stat-icon" />
            <div className="stat-value">
              {calculateAndFormatSpeed(
                //calcule vitesse moyenne ou allure moyenne selon le sport
                activity.total_distance_m,
                activity.moving_time_s,
                activity.sport,
              )}
            </div>
            <div className="stat-label">
              {getSpeedMode(activity.sport) === "SPEED"
                ? "Vitesse moy."
                : "Allure moy."}
            </div>
          </div>
        </div>

        {/* LA CARTE (Maintenant une div simple gérée par Mapbox) */}
        <div className="map-section" ref={mapContainer} />

        {/* SECTION GRAPHIQUE */}
        <div className="chart-section">
          <div
            className="chart-container"
            style={{ width: "100%", height: 300, minHeight: "200px" }}
          >
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#105749" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#105749" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#eee"
                  />
                  <XAxis
                    dataKey="distance"
                    unit="km"
                    minTickGap={30}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis hide />{" "}
                  {/* On cache l'axe Y pour un look plus clean */}
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const sport = activity.sport;
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-dist">
                              {payload[0].payload.distance} km
                            </p>
                            {payload.map((entry: any) => (
                              <p
                                key={entry.dataKey}
                                style={{ color: entry.color }}
                              >
                                {entry.name}:{" "}
                                {entry.dataKey === "speed"
                                  ? formatActivitySpeed(
                                      entry.value / 3.6,
                                      sport,
                                    ) // On divise par 3.6 car entry.value est en km/h dans le graphe
                                  : `${Math.round(entry.value)} ${entry.unit || ""}`}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {activeCurves.altitude && (
                    <Area
                      type="monotone"
                      dataKey="altitude"
                      name="Altitude"
                      unit="m"
                      stroke="#8884d8" // Violet
                      fillOpacity={1}
                      fill="url(#colorSpeed)" // On peut créer d'autres gradients
                    />
                  )}
                  {activeCurves.speed && (
                    <Area
                      type="monotone"
                      dataKey="speed"
                      name={isRunningSport ? "Allure" : "Vitesse"}
                      stroke="#105749" // Vert eden
                      fillOpacity={1}
                      fill="transparent"
                      strokeWidth={2}
                    />
                  )}
                  {activeCurves.heartRate && (
                    <Area
                      type="monotone"
                      dataKey="heartRate"
                      name="Cardio"
                      unit="bpm"
                      stroke="#e11d48" // Rouge
                      fill="transparent"
                      strokeWidth={2}
                    />
                  )}
                  {activeCurves.power && (
                    <Area
                      type="monotone"
                      dataKey="power"
                      name="Puissance"
                      unit=" W"
                      stroke="#f97911" // Orange ecstasy
                      fill="transparent"
                      strokeWidth={2}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: 300,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Chargement des graphiques...
              </div>
            )}
          </div>
          <div className="chart-toggles">
            <button
              className={`toggle-btn ${activeCurves.speed ? "active" : ""}`}
              onClick={() => toggleCurve("speed")}
            >
              <Gauge size={16} /> Vitesse
            </button>
            <button
              className={`toggle-btn ${activeCurves.altitude ? "active" : ""}`}
              onClick={() => toggleCurve("altitude")}
            >
              <TrendingUp size={16} /> Altitude
            </button>
            <button
              className={`toggle-btn ${activeCurves.heartRate ? "active" : ""}`}
              onClick={() => toggleCurve("heartRate")}
            >
              <Heart size={16} /> Cardio
            </button>
            <button
              className={`toggle-btn ${activeCurves.power ? "active" : ""}`}
              onClick={() => toggleCurve("power")}
            >
              <Zap size={16} /> Puissance
            </button>
          </div>
        </div>

        {/* Données physiologiques secondaires */}
        <div className="secondary-section">
          <h3>Données physiologiques</h3>
          <div className="secondary-grid">
            <div className="mini-stat">
              <Heart size={20} className="heart-icon" />
              <span>
                FC Moyenne:{" "}
                <strong>{activity.avg_heart_rate || "--"} bpm</strong>
              </span>
            </div>
            <div className="mini-stat">
              <Heart size={20} className="heart-icon-max" />
              <span>
                FC Max: <strong>{activity.max_heart_rate || "--"} bpm</strong>
              </span>
            </div>
            <div className="mini-stat">
              <Zap size={20} className="power-icon" />
              <span>
                Puissance Moy:{" "}
                <strong>
                  {activity.avg_power ? activity.avg_power : "--"} W
                </strong>
              </span>
            </div>
            <div className="mini-stat">
              <Zap size={20} className="cadence-icon" />
              {/* N'oublie pas le * 2 pour la cadence de running si c'est géré en front ! */}
              <span>
                Cadence:{" "}
                <strong>
                  {activity.avg_cadence
                    ? isRunningSport
                      ? activity.avg_cadence * 2
                      : activity.avg_cadence
                    : "--"}{" "}
                  ppm
                </strong>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ActivityDetail;
