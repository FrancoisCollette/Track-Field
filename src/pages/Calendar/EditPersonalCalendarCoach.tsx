// ============================================================
// EditPersonalCalendarCoach.tsx
// Plan d'entraînement personnel — vue coach.
//
// Fonctionnalités :
//  - Search bar athlètes (uniquement acceptés) avec debounce 300ms
//  - Badges athlètes récemment consultés (localStorage, max 5)
//  - Grille semaine : colonne date sticky + une colonne par jour
//    chaque jour = 2 sous-colonnes (coach | athlète)
//  - Boutons "+ N semaines" en haut et en bas
//  - Bouton flottant "Retour aujourd'hui"
//  - Création/édition des séances côté coach via CalendarModal
//  - Colonne athlète = placeholder "—" (alimenté par CalendarAthlete)
// ============================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  User,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  Clock,
  RefreshCw,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import {
  generateDateRange,
  formatDateKey,
  getMonday,
  TrainingSession,
} from "../../lib/calendarUtils";
import { getAgeCategory } from "../../lib/ageCategory";
import CalendarHeader from "../../components/calendar/CalendarHeader";
import CalendarDateCell from "../../components/calendar/CalendarDateCell";
import CalendarSession from "../../components/calendar/CalendarSession";
import CalendarModal, {
  CalendarModalState,
  SessionForm,
} from "../../components/calendar/CalendarModal";

import "./EditPersonalCalendarCoach.css";
import "../../components/calendar/calendar-shared.css";

// ── Types ────────────────────────────────────────────────────

interface AthleteProfile {
  id: string;
  first_name: string;
  last_name: string;
  birth_year?: number;
}

interface RecentAthlete {
  id: string;
  name: string;
}

// ── Constantes ───────────────────────────────────────────────

const INITIAL_WEEKS = 4;
const STEP_WEEKS = 4;
const RECENT_KEY = "recent_athletes_coach";
const MAX_RECENT = 5;
const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS_FR = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

// ── Helpers ──────────────────────────────────────────────────

/** Lit les athlètes récents depuis localStorage */
function loadRecent(): RecentAthlete[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Sauvegarde un athlète en tête des récents */
function saveRecent(athlete: RecentAthlete) {
  const list = loadRecent().filter((a) => a.id !== athlete.id);
  list.unshift(athlete);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

/** Formatte "Lun 15 Avr" */
function formatDayHeader(date: Date): string {
  // getDay() : 0=dim, 1=lun… on réordonne lundi en premier
  const dayIdx = (date.getDay() + 6) % 7; // lundi=0 … dimanche=6
  return `${DAYS_FR[dayIdx]} ${date.getDate()} ${MOIS_FR[date.getMonth()]}`;
}

// ── Composant ────────────────────────────────────────────────

const EditPersonalCalendarCoach: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Athlète sélectionné ──
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteProfile | null>(
    null,
  );
  const [recentAthletes, setRecentAthletes] =
    useState<RecentAthlete[]>(loadRecent());

  // ── Recherche ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AthleteProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // ── Calendrier ──
  const [weeksBack, setWeeksBack] = useState(0);
  const [weeksForward, setWeeksForward] = useState(INITIAL_WEEKS);
  const [sessions, setSessions] = useState<Map<string, TrainingSession[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);

  // ── Modale ──
  const [modalState, setModalState] = useState<CalendarModalState>({
    open: false,
    date: "",
    contextLabel: "",
    contextColor: "",
    sessionId: null,
  });
  const [form, setForm] = useState<SessionForm>({ title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Scroll / retour today ──
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLTableCellElement>(null);
  const [showBackToday, setShowBackToday] = useState(false);

  // ── Plage de dates ──────────────────────────────────────
  const startDate = useMemo(() => {
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() - weeksBack * 7);
    return monday;
  }, [weeksBack]);

  const dates = useMemo(
    () => generateDateRange(startDate, (weeksBack + weeksForward) * 7),
    [startDate, weeksBack, weeksForward],
  );

  // Groupes les dates par semaine (7 jours)
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < dates.length; i += 7) {
      result.push(dates.slice(i, i + 7));
    }
    return result;
  }, [dates]);

  // ── Recherche athlètes ──────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!user) return;
      setSearchLoading(true);

      // 1. Récupère les IDs des athlètes acceptés par ce coach
      const { data: rels } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", user.id)
        .eq("status", "accepted");

      if (!rels || rels.length === 0) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      const athleteIds = rels.map((r: { athlete_id: string }) => r.athlete_id);
      const q = searchQuery.trim().toLowerCase();

      // 2. Filtre les profils correspondants
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, birth_year")
        .in("id", athleteIds);

      const filtered = (profiles ?? []).filter((p: AthleteProfile) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q),
      );

      setSearchResults(filtered);
      setSearchLoading(false);
    }, 300);
  }, [searchQuery, user]);

  // Ferme la dropdown si clic à l'extérieur
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Sélection athlète ───────────────────────────────────
  const selectAthlete = (athlete: AthleteProfile) => {
    setSelectedAthlete(athlete);
    setSearchQuery("");
    setSearchOpen(false);
    saveRecent({
      id: athlete.id,
      name: `${athlete.first_name} ${athlete.last_name}`,
    });
    setRecentAthletes(loadRecent());
  };

  const selectAthleteById = async (id: string, name: string) => {
    // Charge le profil complet
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, birth_year")
      .eq("id", id)
      .single();
    if (data) selectAthlete(data);
  };

  // ── Chargement séances ──────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!user || !selectedAthlete) return;
    setLoading(true);

    const startKey = formatDateKey(dates[0]);
    const endKey = formatDateKey(dates[dates.length - 1]);

    const { data, error } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("coach_id", user.id)
      .eq("target_type", "personal")
      .eq("target_athlete_id", selectedAthlete.id)
      .gte("date", startKey)
      .lte("date", endKey)
      .order("date");

    if (!error && data) {
      const map = new Map<string, TrainingSession[]>();
      (data as TrainingSession[]).forEach((s) => {
        if (!map.has(s.date)) map.set(s.date, []);
        map.get(s.date)!.push(s);
      });
      setSessions(map);
    }
    setLoading(false);
  }, [user, selectedAthlete, dates]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Scroll to today après chargement initial
  useEffect(() => {
    if (!loading && todayCellRef.current && scrollContainerRef.current) {
      setTimeout(() => {
        todayCellRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [loading, selectedAthlete]);

  // ── Détection retour aujourd'hui ────────────────────────
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handle = () => {
      if (!todayCellRef.current) {
        setShowBackToday(false);
        return;
      }
      const cr = container.getBoundingClientRect();
      const tr = todayCellRef.current.getBoundingClientRect();
      setShowBackToday(!(tr.top < cr.bottom && tr.bottom > cr.top));
    };
    container.addEventListener("scroll", handle, { passive: true });
    return () => container.removeEventListener("scroll", handle);
  }, []);

  // ── Toast ───────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2500);
  };

  // ── Modale ─────────────────────────────────────────────
  const openModal = (dateKey: string, session?: TrainingSession) => {
    setModalState({
      open: true,
      date: dateKey,
      contextLabel: selectedAthlete
        ? `${selectedAthlete.first_name} ${selectedAthlete.last_name}`
        : "Plan personnel",
      contextColor: "#17685a",
      sessionId: session?.id ?? null,
    });
    setForm({
      title: session?.title ?? "",
      description: session?.description ?? "",
    });
  };

  const closeModal = () => setModalState((s) => ({ ...s, open: false }));

  // ── Sauvegarde ─────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !selectedAthlete || !form.title.trim()) return;
    setSaving(true);

    const payload = {
      coach_id: user.id,
      date: modalState.date,
      title: form.title.trim(),
      description: form.description.trim() || null,
      target_type: "personal" as const,
      target_athlete_id: selectedAthlete.id,
    };

    const { error } = modalState.sessionId
      ? await supabase
          .from("training_sessions")
          .update(payload)
          .eq("id", modalState.sessionId)
      : await supabase.from("training_sessions").insert([payload]);

    setSaving(false);
    if (error) {
      showToast("❌ Erreur sauvegarde");
      return;
    }
    closeModal();
    showToast(
      modalState.sessionId ? "✅ Séance mise à jour" : "✅ Séance créée",
    );
    loadSessions();
  };

  const handleDelete = async () => {
    if (!modalState.sessionId) return;
    setDeleting(true);
    const { error } = await supabase
      .from("training_sessions")
      .delete()
      .eq("id", modalState.sessionId);
    setDeleting(false);
    if (error) {
      showToast("❌ Erreur suppression");
      return;
    }
    closeModal();
    showToast("🗑️ Séance supprimée");
    loadSessions();
  };

  // ── Helpers grille ──────────────────────────────────────
  const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
  const isPast = (d: Date) => d < new Date() && !isToday(d);
  const getCoachSessions = (dateKey: string) => sessions.get(dateKey) ?? [];

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="cal-page personal-cal-page">
      {/* Header vert */}
      <CalendarHeader
        title="Plan personnel"
        onBack={() => navigate("/coach/calendar")}
        backLabel="Groupes"
      >
        {selectedAthlete && (
          <span className="personal-cal-athlete-name">
            {selectedAthlete.first_name} {selectedAthlete.last_name}
          </span>
        )}
        <button
          className="cal-btn cal-btn--ghost cal-btn--icon"
          onClick={loadSessions}
          title="Rafraîchir"
        >
          <RefreshCw size={15} />
        </button>
      </CalendarHeader>

      {/* Zone de recherche */}
      <div className="personal-cal-search-area">
        {/* Search bar */}
        <div className="cal-athlete-search">
          <div
            className="cal-athlete-search__input-wrap"
            ref={searchWrapRef}
            style={{ position: "relative" }}
          >
            <Search size={14} />
            <input
              className="cal-athlete-search__input"
              placeholder="Rechercher un athlète…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchQuery && (
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "#4a6a5a",
                  cursor: "pointer",
                  lineHeight: 0,
                }}
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <X size={14} />
              </button>
            )}

            {/* Dropdown résultats */}
            {searchOpen && (searchResults.length > 0 || searchLoading) && (
              <div className="cal-athlete-results">
                {searchLoading && (
                  <div
                    style={{
                      padding: "12px 16px",
                      color: "#4a6a5a",
                      fontSize: "0.82rem",
                    }}
                  >
                    Recherche…
                  </div>
                )}
                {searchResults.map((a) => (
                  <div
                    key={a.id}
                    className="cal-athlete-result-item"
                    onClick={() => selectAthlete(a)}
                  >
                    <User size={14} style={{ color: "#4a6a5a" }} />
                    <span className="cal-athlete-result-item__name">
                      {a.first_name} {a.last_name}
                    </span>
                    {a.birth_year && (
                      <span className="cal-athlete-result-item__cat">
                        {getAgeCategory(a.birth_year)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Badges récents */}
        {recentAthletes.length > 0 && (
          <div className="cal-recent-badges">
            <Clock size={12} style={{ color: "#3a5a4a", flexShrink: 0 }} />
            {recentAthletes.map((a) => (
              <button
                key={a.id}
                className={`cal-recent-badge ${selectedAthlete?.id === a.id ? "cal-recent-badge--active" : ""}`}
                onClick={() => selectAthleteById(a.id, a.name)}
              >
                <User size={11} />
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Contenu principal ── */}
      {!selectedAthlete ? (
        /* Message si aucun athlète sélectionné */
        <div className="personal-cal-empty">
          <User size={40} />
          <p>Sélectionnez un athlète pour afficher son plan</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="cal-toolbar">
            <div className="cal-toolbar__left">
              <span style={{ fontSize: "0.78rem", color: "#4a6a5a" }}>
                {weeksBack + weeksForward} semaines affichées
              </span>
            </div>
          </div>

          {/* Zone de scroll */}
          <div className="cal-scroll-container" ref={scrollContainerRef}>
            <table className="cal-grid">
              <tbody>
                {/* ── HEADER ROW ── */}
                <tr className="cal-grid__header-row">
                  {/* Coin sticky */}
                  <td className="cal-grid__corner" />

                  {/* Une colonne par semaine, chaque semaine = 7 jours */}
                  {weeks.map((week, wIdx) =>
                    week.map((date) => {
                      const isT = isToday(date);
                      const dayLabel = formatDayHeader(date);
                      return (
                        <td
                          key={formatDateKey(date)}
                          className={`cal-grid__col-head personal-cal__col-head ${
                            wIdx % 2 === 1 ? "personal-cal__col-head--even" : ""
                          }`}
                          style={{
                            minWidth: 280,
                            padding: 0,
                            verticalAlign: "bottom",
                          }}
                        >
                          {/* Date en haut */}
                          <div
                            style={{
                              padding: "6px 12px",
                              textAlign: "center",
                              fontFamily:
                                "var(--font-display, Syne, sans-serif)",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              color: isT ? "#cbf498" : "#7a9e8a",
                              borderBottom: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            {dayLabel}
                            {isT && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: "0.65rem",
                                  background: "rgba(203,244,152,0.2)",
                                  color: "#cbf498",
                                  padding: "1px 6px",
                                  borderRadius: 8,
                                }}
                              >
                                Aujourd'hui
                              </span>
                            )}
                          </div>
                          {/* Sous-labels Coach / Athlète */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                            }}
                          >
                            <div className="personal-cal-sub-label personal-cal-sub-label--coach">
                              Coach
                            </div>
                            <div className="personal-cal-sub-label personal-cal-sub-label--athlete">
                              Athlète
                            </div>
                          </div>
                        </td>
                      );
                    }),
                  )}
                </tr>

                {/* ── BOUTON "+ semaines" EN HAUT ── */}
                <tr>
                  <td colSpan={dates.length + 1} style={{ padding: 0 }}>
                    <button
                      className="cal-btn cal-btn--expand"
                      onClick={() => setWeeksBack((w) => w + STEP_WEEKS)}
                    >
                      <ChevronUp size={14} />
                      {STEP_WEEKS} semaines de plus (avant)
                    </button>
                  </td>
                </tr>

                {/* ── LIGNE PAR DATE ──
                    Structure : chaque date = 1 ligne avec :
                    - colonne date sticky
                    - pour chaque date : 2 cellules (coach | athlète)
                    
                    Attention : le plan perso affiche une ligne par semaine
                    (7 cellules par semaine = 14 demi-cellules coach+athlète).
                    On fait plutôt une ligne par SEMAINE dans la grille,
                    et chaque "cellule" est divisée en coach|athlète.
                    
                    Pour coller avec le CSS sticky déjà établi,
                    on garde 1 ligne = 1 jour, et on met 2 td par jour.
                    La colonne date est remplacée par le numéro de semaine.
                ── */}

                {/* On affiche les semaines une par une */}
                {weeks.map((week, wIdx) => (
                  <React.Fragment key={wIdx}>
                    {/* Séparateur entre semaines */}
                    {wIdx > 0 && (
                      <tr>
                        <td
                          colSpan={dates.length + 1}
                          style={{
                            height: 4,
                            background: "rgba(255,255,255,0.04)",
                            padding: 0,
                          }}
                        />
                      </tr>
                    )}

                    {/* UNE ligne par semaine, avec pour chaque jour 2 cellules */}
                    <tr className="cal-grid__body-row">
                      {/* Cellule date sticky — affiche le numéro de semaine */}
                      <td
                        className="cal-date-cell"
                        ref={week.some(isToday) ? todayCellRef : undefined}
                        style={{ verticalAlign: "middle", textAlign: "center" }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--font-display, Syne, sans-serif)",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: "#3a5a4a",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          Sem.
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-display, Syne, sans-serif)",
                            fontSize: "1.3rem",
                            fontWeight: 700,
                            color: week.some(isToday) ? "#cbf498" : "#4a6a5a",
                            lineHeight: 1,
                          }}
                        >
                          {/* Numéro ISO de la semaine */}
                          {getISOWeek(week[0])}
                        </div>
                        <div
                          style={{
                            fontSize: "0.65rem",
                            color: "#2d4a3a",
                            marginTop: 2,
                          }}
                        >
                          {week[0].getDate()} {MOIS_FR[week[0].getMonth()]}
                        </div>
                      </td>

                      {/* Pour chaque jour de la semaine : 2 cellules */}
                      {week.map((date) => {
                        const dateKey = formatDateKey(date);
                        const coachSessions = getCoachSessions(dateKey);
                        const past = isPast(date);
                        const today = isToday(date);

                        return (
                          <React.Fragment key={dateKey}>
                            {/* Cellule COACH */}
                            <td
                              className={`cal-personal-cell cal-personal-cell--coach personal-cal-cell-separator ${
                                today ? "cal-grid__body-row--today" : ""
                              } ${past ? "cal-cell--past" : ""}`}
                              onClick={() => {
                                if (!past) openModal(dateKey);
                              }}
                            >
                              {coachSessions.length > 0
                                ? coachSessions.map((s) => (
                                    <CalendarSession
                                      key={s.id}
                                      session={s}
                                      color="#17685a"
                                      onClick={(sess) =>
                                        openModal(dateKey, sess)
                                      }
                                    />
                                  ))
                                : !past && (
                                    <div className="cal-cell__add-hint">+</div>
                                  )}
                            </td>

                            {/* Cellule ATHLÈTE (read-only pour l'instant) */}
                            <td
                              className={`cal-personal-cell cal-personal-cell--athlete ${
                                today ? "cal-grid__body-row--today" : ""
                              }`}
                            >
                              <div className="cal-personal-placeholder">—</div>
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                ))}

                {/* ── BOUTON "+ semaines" EN BAS ── */}
                <tr>
                  <td colSpan={dates.length + 1} style={{ padding: 0 }}>
                    <button
                      className="cal-btn cal-btn--expand"
                      onClick={() => setWeeksForward((w) => w + STEP_WEEKS)}
                    >
                      <ChevronDown size={14} />
                      {STEP_WEEKS} semaines de plus (après)
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bouton flottant retour aujourd'hui */}
          <button
            className={`cal-back-today-btn ${
              showBackToday
                ? "cal-back-today-btn--visible"
                : "cal-back-today-btn--hidden"
            }`}
            onClick={() =>
              todayCellRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              })
            }
          >
            <ArrowUp size={14} />
            Retour aujourd'hui
          </button>
        </>
      )}

      {/* Modale */}
      <CalendarModal
        state={modalState}
        form={form}
        saving={saving}
        deleting={deleting}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
        onFormChange={(field, val) => setForm((f) => ({ ...f, [field]: val }))}
      />

      {/* Toast */}
      {toast && <div className="cal-toast">{toast}</div>}
    </div>
  );
};

// ── Utilitaire numéro de semaine ISO ─────────────────────────
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Jeudi de la semaine courante
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

export default EditPersonalCalendarCoach;
