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
  AlertCircle,
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
  const markerRef = useRef<mapboxgl.Marker | null>(null); //Référence pour le marqueur dynamique

  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [streamsError, setStreamsError] = useState<boolean>(false);

  const [chartData, setChartData] = useState<any[]>([]);
  const [activeCurves, setActiveCurves] = useState({
    speed: false,
    altitude: true, // Par défaut, on affiche l'altitude
    heartRate: false,
    power: false,
  });
  const [lastLeftAxis, setLastLeftAxis] = useState<"altitude" | "speed">(
    "altitude",
  );
  const [lastRightAxis, setLastRightAxis] = useState<"heartRate" | "power">(
    "heartRate",
  );

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
      !streamsError &&
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
      setStreamsError(false);

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
        try {
          const { chartData: newChartData } = await fetchActivityStreams(
            id,
            session.access_token,
            WORKER_URL,
          );
          setChartData(newChartData);
        } catch (err) {
          // C'est ici que l'erreur 404 est capturée
          console.error("Erreur spécifique aux streams:", err);
          setStreamsError(true);
        }
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
      map.current.resize();

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

      // Ajustement automatique du zoom avec un timeout pour laisser le temps
      // au css de charger la div à la bonne taille
      setTimeout(() => {
        if (!map.current) return;
        const bounds = coords.reduce(
          (acc, coord) => acc.extend(coord as [number, number]),
          new mapboxgl.LngLatBounds(
            coords[0] as [number, number],
            coords[0] as [number, number],
          ),
        );
        // On réduit un peu le padding sur mobile pour être sûr de tout voir
        const isMobile = window.innerWidth < 500;

        map.current.fitBounds(bounds, {
          padding: isMobile ? 20 : 40, // Moins de padding sur petit écran
          duration: 1000,
        });
        // On rappelle resize une fois l'animation lancée pour la sécurité
        map.current.resize();
      }, 100); // Un délai de 100ms est invisible mais laisse le temps au css d'être stabiliser et mapbox s'initialise correctement

      // Resize la carte si le countainer change de taille (utilisateur tourne téléphone,...)
      const resizeObserver = new ResizeObserver(() => {
        map.current?.resize();
      });

      if (mapContainer.current) {
        resizeObserver.observe(mapContainer.current);
      }
    });
  };

  const toggleCurve = (key: keyof typeof activeCurves) => {
    setActiveCurves((prev) => {
      const newState = { ...prev, [key]: !prev[key] };

      // Si on active une courbe, elle devient la priorité visuelle pour son côté
      if (newState[key]) {
        if (key === "altitude" || key === "speed") setLastLeftAxis(key);
        if (key === "heartRate" || key === "power") setLastRightAxis(key);
      }
      // Si on désactive la courbe prioritaire, on bascule sur l'autre
      else {
        if (key === "altitude") setLastLeftAxis("speed");
        if (key === "speed") setLastLeftAxis("altitude");
        if (key === "heartRate") setLastRightAxis("power");
        if (key === "power") setLastRightAxis("heartRate");
      }

      return newState;
    });
  };

  //FONCTION DE MISE À JOUR DU MARQUEUR (On l'extrait pour pouvoir l'appeler facilement)

  const updateMapMarker = (dataPoint: any) => {
    if (!dataPoint || !dataPoint.latlng || !map.current) return;

    const coords: [number, number] = [
      dataPoint.latlng[1], // Longitude
      dataPoint.latlng[0], // Latitude
    ];

    if (!markerRef.current) {
      // 1. Création d'un élément HTML personnalisé pour le "point"
      const el = document.createElement("div");
      el.className = "custom-marker-point";

      // 2. Style direct pour s'assurer qu'il ressemble à un point
      // Tu peux aussi mettre ces styles dans ton fichier .css
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.backgroundColor = "#650901";
      el.style.borderRadius = "50%"; // Cercle parfait
      el.style.border = "2px solid white"; // Contour pour le contraste
      el.style.boxShadow = "0 0 5px rgba(0,0,0,0.3)"; // Ombre légère

      // 3. Initialisation du marqueur avec l'élément personnalisé
      markerRef.current = new mapboxgl.Marker({
        element: el, // On passe notre div ici
        anchor: "center", // On centre le point exactement sur la coordonnée
      })
        .setLngLat(coords)
        .addTo(map.current);
    } else {
      markerRef.current.setLngLat(coords);
    }
  };

  //GESTIONNAIRE D'ÉVÉNEMENT UNIQUE
  const handleChartInteraction = (e: any) => {
    if (e && e.activeCoordinate) {
      // Recharts nous donne l'index du point survolé
      const index = e.activeTooltipIndex;
      const dataPoint = chartData[index];

      if (dataPoint && dataPoint.latlng) {
        updateMapMarker(dataPoint);
      }
    }
  };
  // On retire le marqueur quand on quitte le graphique
  const handleChartMouseLeave = () => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
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
        <div className="map-section">
          {/* On vérifie si on a une erreur de streams en premier */}
          {streamsError ? (
            <div className="map-error-placeholder">
              <div className="error-content">
                {/* Utilisation d'une icône svg pour le visuel */}
                <div className="error-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    version="1.1"
                    width="50"
                    height="50"
                  >
                    <path
                      d="M0 0 C6 1 6 1 9 2.6875 C11.95556491 4.33101459 11.95556491 4.33101459 15.125 3.3125 C17.88881801 2.09941071 17.88881801 2.09941071 20 0.875 C22.92476753 -0.40458579 24.80980989 -0.3611536 28 0 C29.51541418 0.6747266 31.01479752 1.38614297 32.5 2.125 C35.78357391 3.6922857 36.6080653 4.07394994 40.3125 3.375 C41.93828655 2.54320223 43.56346728 1.71021683 45.1875 0.875 C47 0 47 0 50 0 C50 13.53 50 27.06 50 41 C38.57142857 46.71428571 38.57142857 46.71428571 33 45 C31.96875 44.46375 30.9375 43.9275 29.875 43.375 C26.51122477 41.76623793 25.46370892 41.78770188 22 43 C21.030625 43.515625 20.06125 44.03125 19.0625 44.5625 C15.48523841 46.24162279 13.90823032 46.6012662 10 46 C6.7 44.35 3.4 42.7 0 41 C0 27.47 0 13.94 0 0 Z M20.1875 5 C16.58174702 6.85231551 14.11154772 7.62567031 10 7 C7.9697411 6.06295743 5.96303418 5.07074592 4 4 C3.34 4 2.68 4 2 4 C2 15.22 2 26.44 2 38 C10.67201859 43.561367 10.67201859 43.561367 15.375 42.4375 C16.92086489 41.59095494 18.46386529 40.73907578 20 39.875 C22.92476753 38.59541421 24.80980989 38.6388464 28 39 C29.51541418 39.6747266 31.01479752 40.38614297 32.5 41.125 C35.72764656 42.65759057 36.61438829 43.06674049 40.25 42.4375 C41.1575 41.963125 42.065 41.48875 43 41 C43.87164795 40.63479248 44.7432959 40.26958496 45.64135742 39.89331055 C48.37436244 38.13146478 48.37436244 38.13146478 48.56762695 34.53833008 C48.56683711 33.11515157 48.53868344 31.69181719 48.48828125 30.26953125 C48.47766914 29.14390022 48.47766914 29.14390022 48.46684265 27.99552917 C48.43886657 25.60016905 48.37613009 23.20715253 48.3125 20.8125 C48.28742092 19.18818482 48.26460706 17.56383297 48.24414062 15.93945312 C48.18903043 11.95873329 48.10274233 7.97976385 48 4 C47.07960937 4.31195313 46.15921875 4.62390625 45.2109375 4.9453125 C36.80089974 7.70773366 36.80089974 7.70773366 32.8828125 6.16796875 C31.50127619 5.45189773 30.1370831 4.70087903 28.796875 3.91015625 C25.35168607 2.16509316 23.2883664 3.2385611 20.1875 5 Z "
                      fill="#000000"
                      transform="translate(0,2)"
                    />
                    <path
                      d="M0 0 C2.375 1.0625 2.375 1.0625 4 3 C4.66067969 7.37700291 4.34131552 9.42747074 2.0625 13.25 C1.381875 14.1575 0.70125 15.065 0 16 C-0.33 16.99 -0.66 17.98 -1 19 C-2.32 19 -3.64 19 -5 19 C-5.57154648 14.14185495 -3.71330785 11.90038004 -1 8 C-1 7.01 -1 6.02 -1 5 C-2.32 4.67 -3.64 4.34 -5 4 C-5.33 4.99 -5.66 5.98 -6 7 C-7.32 7 -8.64 7 -10 7 C-9.6875 4.625 -9.6875 4.625 -9 2 C-5.51131349 -0.32579101 -4.10281481 -0.41865457 0 0 Z "
                      fill="#000000"
                      transform="translate(28,11)"
                    />
                    <path
                      d="M0 0 C1.32 0 2.64 0 4 0 C4 1.65 4 3.3 4 5 C2.68 5 1.36 5 0 5 C0 3.35 0 1.7 0 0 Z "
                      fill="#000000"
                      transform="translate(23,32)"
                    />
                  </svg>
                </div>
                <h3>Carte indisponible</h3>
                <p>
                  Les données de tracé GPS sont manquantes pour cette activité.
                </p>
              </div>
            </div>
          ) : (
            /* Si pas d'erreur, on affiche le container classique */
            <div
              ref={mapContainer}
              className="map-container"
              style={{ width: "100%", borderRadius: "12px" }}
            />
          )}
        </div>

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
                  margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                  onMouseMove={handleChartInteraction}
                  onMouseLeave={handleChartMouseLeave}
                  onTouchMove={handleChartInteraction}
                  onTouchEnd={handleChartMouseLeave}
                >
                  <defs>
                    <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />{" "}
                      {/*gradient violet couleur de la courbe altitude*/}
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#eee"
                  />
                  <XAxis
                    dataKey="distance"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(val) => `${val.toFixed(2)} km`}
                    tick={{ fontSize: 10 }}
                  />
                  {/* Double Axe Y pour éviter l'écrasement des lignes */}
                  {/* Axe gauche pour l'altitude */}
                  <YAxis
                    yAxisId="altitude"
                    orientation="left"
                    tick={{ fontSize: 12 }}
                    unit="m"
                    stroke="#8884d8"
                    // On cache l'axe si l'altitude est désactivée, OU si la vitesse prend la place visuelle
                    hide={
                      !activeCurves.altitude ||
                      (activeCurves.speed && lastLeftAxis === "speed")
                    }
                    width={
                      activeCurves.speed && lastLeftAxis === "speed" ? 0 : 40
                    }
                  />
                  {/* Axe Gauche 2 : Vitesse */}
                  <YAxis
                    yAxisId="speed"
                    orientation="left"
                    tick={{ fontSize: 12 }}
                    stroke="#105749"
                    // On l'affiche dès que la vitesse est active (elle a la priorité visuelle à gauche)
                    hide={
                      !activeCurves.speed ||
                      (activeCurves.altitude && lastLeftAxis === "altitude")
                    }
                    width={
                      activeCurves.altitude && lastLeftAxis === "altitude"
                        ? 0
                        : 40
                    }
                    tickFormatter={(val) =>
                      formatActivitySpeed(val, activity.sport)
                    }
                  />
                  {/* Axe Droit 1 : Cardio */}
                  <YAxis
                    yAxisId="heartRate"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    stroke="#e11d48"
                    // On l'affiche dès que le cardio est actif (il a la priorité visuelle à droite)
                    hide={
                      !activeCurves.heartRate ||
                      (activeCurves.power && lastRightAxis === "power")
                    }
                    width={
                      activeCurves.power && lastRightAxis === "power" ? 0 : 30
                    }
                  />
                  {/* Axe Droit 2 : Puissance */}
                  <YAxis
                    yAxisId="power"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    stroke="#f97911"
                    // On cache l'axe si la puissance est désactivée, OU si le cardio prend la place visuelle
                    hide={
                      !activeCurves.power ||
                      (activeCurves.heartRate && lastRightAxis === "heartRate")
                    }
                    width={
                      activeCurves.heartRate && lastRightAxis === "heartRate"
                        ? 0
                        : 30
                    }
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const sport = activity.sport;
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-dist">
                              {Math.round(payload[0].payload.distance * 100) /
                                100}{" "}
                              km
                            </p>
                            {payload.map((entry: any) => (
                              <p
                                key={entry.dataKey}
                                style={{ color: entry.color }}
                              >
                                {entry.name}:{" "}
                                {entry.dataKey === "speed"
                                  ? formatActivitySpeed(entry.value, sport)
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
                      yAxisId="altitude"
                      type="monotone"
                      dataKey="altitude"
                      name="Altitude"
                      unit="m"
                      stroke="#8884d8" // Violet
                      fillOpacity={1}
                      fill="url(#colorAlt)" // On peut créer d'autres gradients
                      strokeWidth={1}
                    />
                  )}
                  {activeCurves.speed && (
                    <Area
                      yAxisId="speed"
                      type="monotone"
                      dataKey="speed"
                      name={isRunningSport ? "Allure" : "Vitesse"}
                      stroke="#105749" // Vert eden
                      fillOpacity={1}
                      fill="transparent"
                      strokeWidth={1}
                    />
                  )}
                  {activeCurves.heartRate && (
                    <Area
                      yAxisId="heartRate"
                      type="monotone"
                      dataKey="heartRate"
                      name="Cardio"
                      unit="bpm"
                      stroke="#e11d48" // Rouge
                      fill="transparent"
                      strokeWidth={1}
                    />
                  )}
                  {activeCurves.power && (
                    <Area
                      yAxisId="power"
                      type="monotone"
                      dataKey="power"
                      name="Puissance"
                      unit=" W"
                      stroke="#f97911" // Orange ecstasy
                      fill="transparent"
                      strokeWidth={1}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : streamsError ? (
              <div className="no-data-message">
                <AlertCircle size={24} />
                <span>
                  Aucune donnée détaillée (GPS/Puissance) disponible pour cette
                  activité. Contacter le support pour vérifier que le fichiers
                  des données brutes existe sur le stockage.
                </span>
              </div>
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
              <Gauge size={16} /> {isRunningSport ? "Allure" : "Vitesse"}
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
              <Zap size={20} className="power-icon-max" />
              <span>
                Puissance Max: <strong>{activity.max_power || "--"} W</strong>
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
