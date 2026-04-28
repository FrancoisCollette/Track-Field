// ============================================================
// EditCalendarCoach.tsx
// Calendrier d'entraînement par groupes — vue coach.
//
// Fonctionnalités :
//  - Grille scrollable : colonne date sticky gauche,
//    header groupes sticky haut, scroll horizontal/vertical indépendants
//  - Chargement initial : 4 semaines depuis lundi de la semaine actuelle
//  - Boutons "4 semaines de plus" en haut ET en bas du calendrier
//  - Bouton flottant "Retour aujourd'hui" quand today n'est plus visible
//  - Création/édition/suppression via CalendarModal
//  - Copie automatique vers groupes liés (GROUP_COPY_RULES)
//  - Bouton copie manuelle par séance
//  - Toast feedback pour les actions
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronUp,
  ChevronDown,
  ArrowUp,
  RefreshCw,
  Copy,
  CheckCircle2,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import {
  generateDateRange,
  formatDateKey,
  getMonday,
  TrainingSession,
} from "../../lib/calendarUtils";
import { TRAINING_GROUPS, getCopyTargets } from "../../lib/trainingGroups";
import CalendarHeader from "../../components/calendar/CalendarHeader";
import CalendarDateCell from "../../components/calendar/CalendarDateCell";
import CalendarSession from "../../components/calendar/CalendarSession";
import CalendarModal, {
  CalendarModalState,
  SessionForm,
} from "../../components/calendar/CalendarModal";

import "./EditCalendarCoach.css";
import "../../components/calendar/calendar-shared.css";

// ── Constantes ──────────────────────────────────────────────

/** Nombre de semaines affichées initialement */
const INITIAL_WEEKS = 4;
/** Nombre de semaines ajoutées à chaque clic "plus" */
const STEP_WEEKS = 4;

// ── Composant ───────────────────────────────────────────────

const EditCalendarCoach: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── État du calendrier ──
  // weeksBack  : semaines ajoutées AVANT la semaine actuelle
  // weeksForward : semaines affichées APRÈS la semaine actuelle
  const [weeksBack, setWeeksBack] = useState(0);
  const [weeksForward, setWeeksForward] = useState(INITIAL_WEEKS);

  // Sessions chargées depuis Supabase : Map<dateKey, TrainingSession[]>
  const [sessions, setSessions] = useState<Map<string, TrainingSession[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);

  // ── État de la modale ──
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
  // Groupe courant sélectionné (pour la modale)
  const [currentGroup, setCurrentGroup] = useState("");
  // Toggle copie automatique
  const [autoCopy, setAutoCopy] = useState(true);

  // ── Toast ──
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Refs pour scroll et "retour aujourd'hui" ──
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLTableCellElement>(null);
  const [showBackToday, setShowBackToday] = useState(false);

  // ── Calcul de la plage de dates ──────────────────────────
  // On part du lundi de la semaine actuelle, en reculant weeksBack semaines
  const startDate = React.useMemo(() => {
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() - weeksBack * 7);
    return monday;
  }, [weeksBack]);

  const totalWeeks = weeksBack + weeksForward;

  // Génère toutes les dates à afficher (1 date par ligne)
  const dates = React.useMemo(
    () => generateDateRange(startDate, totalWeeks * 7),
    [startDate, totalWeeks],
  );

  // ── Chargement des séances depuis Supabase ────────────────
  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Bornes de la requête
    const startKey = formatDateKey(dates[0]);
    const endKey = formatDateKey(dates[dates.length - 1]);

    const { data, error } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("coach_id", user.id)
      .eq("target_type", "group")
      .gte("date", startKey)
      .lte("date", endKey)
      .order("date");

    if (error) {
      console.error("Erreur chargement séances:", error);
      setLoading(false);
      return;
    }

    // On reconstruit la Map dateKey → sessions[]
    const map = new Map<string, TrainingSession[]>();
    (data as TrainingSession[]).forEach((s) => {
      const key = s.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });

    setSessions(map);
    setLoading(false);
  }, [user, dates]);

  // Recharge quand la plage change
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // ── Scroll automatique vers aujourd'hui ──────────────────
  useEffect(() => {
    if (!loading && todayCellRef.current && scrollContainerRef.current) {
      // Petit délai pour laisser le DOM se stabiliser
      setTimeout(() => {
        todayCellRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [loading]);

  // ── Détection "retour aujourd'hui" ───────────────────────
  // On observe si la cellule today est visible dans le container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!todayCellRef.current) {
        setShowBackToday(false);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const cellRect = todayCellRef.current.getBoundingClientRect();
      // La cellule est visible si elle intersecte verticalement le container
      const visible =
        cellRect.top < containerRect.bottom &&
        cellRect.bottom > containerRect.top;
      setShowBackToday(!visible);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Toast helper ─────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  // ── Ouverture de la modale ────────────────────────────────
  const openModal = (
    date: string,
    groupId: string,
    session?: TrainingSession,
  ) => {
    const group = TRAINING_GROUPS.find((g) => g.id === groupId);
    if (!group) return;

    setCurrentGroup(groupId);
    setModalState({
      open: true,
      date,
      contextLabel: group.label,
      contextColor: group.color,
      sessionId: session?.id ?? null,
    });
    setForm({
      title: session?.title ?? "",
      description: session?.description ?? "",
    });
  };

  const closeModal = () => {
    setModalState((s) => ({ ...s, open: false }));
  };

  // ── Sauvegarde ───────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !form.title.trim()) return;
    setSaving(true);

    const payload = {
      coach_id: user.id,
      date: modalState.date,
      title: form.title.trim(),
      description: form.description.trim() || null,
      target_type: "group" as const,
      target_group: currentGroup,
    };

    let error: unknown;

    if (modalState.sessionId) {
      // Mise à jour
      ({ error } = await supabase
        .from("training_sessions")
        .update(payload)
        .eq("id", modalState.sessionId));
    } else {
      // Création
      ({ error } = await supabase.from("training_sessions").insert([payload]));

      // Copie automatique vers groupes liés
      if (!error && autoCopy) {
        const targets = getCopyTargets(currentGroup);
        if (targets.length > 0) {
          const copies = targets.map((tg) => ({
            ...payload,
            target_group: tg,
          }));
          await supabase.from("training_sessions").insert(copies);
        }
      }
    }

    setSaving(false);

    if (error) {
      console.error("Erreur sauvegarde:", error);
      showToast("❌ Erreur lors de la sauvegarde");
    } else {
      closeModal();
      showToast(
        modalState.sessionId ? "✅ Séance mise à jour" : "✅ Séance créée",
      );
      loadSessions();
    }
  };

  // ── Suppression ──────────────────────────────────────────
  const handleDelete = async () => {
    if (!modalState.sessionId) return;
    setDeleting(true);

    const { error } = await supabase
      .from("training_sessions")
      .delete()
      .eq("id", modalState.sessionId);

    setDeleting(false);

    if (error) {
      console.error("Erreur suppression:", error);
      showToast("❌ Erreur lors de la suppression");
    } else {
      closeModal();
      showToast("🗑️ Séance supprimée");
      loadSessions();
    }
  };

  // ── Copie manuelle d'une séance ──────────────────────────
  const handleCopySession = async (
    session: TrainingSession,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!user) return;

    const targets = getCopyTargets(session.target_group ?? "");
    if (targets.length === 0) {
      showToast("⚠️ Aucun groupe lié configuré");
      return;
    }

    const copies = targets.map((tg) => ({
      coach_id: user.id,
      date: session.date,
      title: session.title,
      description: session.description ?? null,
      target_type: "group" as const,
      target_group: tg,
    }));

    const { error } = await supabase.from("training_sessions").insert(copies);

    if (error) {
      showToast("❌ Erreur lors de la copie");
    } else {
      showToast(`✅ Copié vers ${targets.join(", ")}`);
      loadSessions();
    }
  };

  // ── Retour aujourd'hui ───────────────────────────────────
  const scrollToToday = () => {
    todayCellRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  // ── Helpers UI ───────────────────────────────────────────
  // Vérifie si une date est aujourd'hui
  const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
  // Vérifie si une date est dans le passé
  const isPast = (d: Date) => d < new Date() && !isToday(d);

  // Récupère les séances pour une date + groupe donné
  const getSessionsFor = (
    dateKey: string,
    groupId: string,
  ): TrainingSession[] => {
    return (sessions.get(dateKey) ?? []).filter(
      (s) => s.target_group === groupId,
    );
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="cal-page coach-cal-page">
      {/* ── Header vert ── */}
      <CalendarHeader
        title="Calendrier groupes"
        onBack={() => navigate("/dashboard")}
      >
        {/* Indicateur nombre de semaines */}
        <span className="coach-cal-weeks-info">{totalWeeks} sem.</span>
        {/* Bouton rafraîchir */}
        <button
          className="cal-btn cal-btn--ghost cal-btn--icon"
          onClick={loadSessions}
          title="Rafraîchir"
        >
          <RefreshCw size={15} />
        </button>
      </CalendarHeader>

      {/* ── Toolbar ── */}
      <div className="cal-toolbar">
        <div className="cal-toolbar__left">
          {/* Lien vers plan perso */}
          <button
            className="cal-btn cal-btn--ghost"
            onClick={() => navigate("/coach/calendar/personal")}
          >
            Plans personnels
          </button>
        </div>
        <div className="cal-toolbar__right">
          {/* Info copie auto */}
          {autoCopy && (
            <span className="coach-cal-autocopy-badge">
              <Copy size={10} /> Copie auto active
            </span>
          )}
        </div>
      </div>

      {/* ── Zone de scroll (double scroll) ── */}
      <div className="cal-scroll-container" ref={scrollContainerRef}>
        {/* La grille utilise display:table pour permettre
            position:sticky sur les cellules td/th */}
        <table className="cal-grid">
          <tbody>
            {/* ─────────────────────────────────────────────
                HEADER ROW (sticky top)
                Coin vide + une cellule par groupe
                ───────────────────────────────────────────── */}
            <tr className="cal-grid__header-row">
              {/* Coin sticky top+left */}
              <td className="cal-grid__corner" />

              {/* Une cellule header par groupe */}
              {TRAINING_GROUPS.map((group) => (
                <td key={group.id} className="cal-grid__col-head">
                  <div className="cal-col-head__inner">
                    {/* Pastille couleur */}
                    <div
                      className="cal-col-head__dot"
                      style={{ background: group.color }}
                    />
                    <span className="cal-col-head__label">{group.label}</span>
                  </div>
                </td>
              ))}
            </tr>

            {/* ─────────────────────────────────────────────
                BOUTON "4 SEMAINES DE PLUS" EN HAUT
                Collé en haut du body, avant les lignes de dates
                ───────────────────────────────────────────── */}
            <tr>
              <td colSpan={TRAINING_GROUPS.length + 1} style={{ padding: 0 }}>
                <button
                  className="cal-btn cal-btn--expand"
                  onClick={() => setWeeksBack((w) => w + STEP_WEEKS)}
                >
                  <ChevronUp size={14} />
                  Afficher {STEP_WEEKS} semaines de plus (avant)
                </button>
              </td>
            </tr>

            {/* ─────────────────────────────────────────────
                LIGNES DE DATES
                Une ligne par jour
                ───────────────────────────────────────────── */}
            {dates.map((date, idx) => {
              const dateKey = formatDateKey(date);
              const todayRow = isToday(date);
              const pastRow = isPast(date);
              const isSunday = date.getDay() === 0;
              // Séparateur entre semaines (on coupe le lundi)
              const isMonday = date.getDay() === 1 && idx > 0;

              return (
                <React.Fragment key={dateKey}>
                  {/* Séparateur visuel entre semaines */}
                  {isMonday && (
                    <tr>
                      <td
                        colSpan={TRAINING_GROUPS.length + 1}
                        className="coach-cal-week-sep"
                        style={{
                          height: 3,
                          background: "rgba(255,255,255,0.04)",
                        }}
                      />
                    </tr>
                  )}

                  <tr
                    className={[
                      "cal-grid__body-row",
                      todayRow ? "cal-grid__body-row--today" : "",
                    ].join(" ")}
                  >
                    {/* Cellule date sticky gauche */}
                    <CalendarDateCell
                      date={date}
                      todayRef={todayRow ? todayCellRef : undefined}
                    />

                    {/* Une cellule par groupe */}
                    {TRAINING_GROUPS.map((group) => {
                      const groupSessions = getSessionsFor(dateKey, group.id);
                      return (
                        <td
                          key={group.id}
                          className={[
                            "cal-cell",
                            pastRow ? "cal-cell--past" : "",
                          ].join(" ")}
                          // Clic sur la cellule = créer une séance
                          onClick={() => {
                            if (!pastRow) openModal(dateKey, group.id);
                          }}
                        >
                          {/* Séances existantes */}
                          {groupSessions.map((session) => (
                            <CalendarSession
                              key={session.id}
                              session={session}
                              color={group.color}
                              onClick={(s) => openModal(dateKey, group.id, s)}
                              onCopy={handleCopySession}
                              showCopyBtn={getCopyTargets(group.id).length > 0}
                            />
                          ))}

                          {/* Hint "+" au hover sur cellule vide */}
                          {groupSessions.length === 0 && !pastRow && (
                            <div className="cal-cell__add-hint">+</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}

            {/* ─────────────────────────────────────────────
                BOUTON "4 SEMAINES DE PLUS" EN BAS
                ───────────────────────────────────────────── */}
            <tr>
              <td colSpan={TRAINING_GROUPS.length + 1} style={{ padding: 0 }}>
                <button
                  className="cal-btn cal-btn--expand"
                  onClick={() => setWeeksForward((w) => w + STEP_WEEKS)}
                >
                  <ChevronDown size={14} />
                  Afficher {STEP_WEEKS} semaines de plus (après)
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Bouton flottant "Retour aujourd'hui" ── */}
      <button
        className={`cal-back-today-btn ${
          showBackToday
            ? "cal-back-today-btn--visible"
            : "cal-back-today-btn--hidden"
        }`}
        onClick={scrollToToday}
      >
        <ArrowUp size={14} />
        Retour aujourd'hui
      </button>

      {/* ── Modale création/édition ── */}
      <CalendarModal
        state={modalState}
        form={form}
        saving={saving}
        deleting={deleting}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
        onFormChange={(field, val) => setForm((f) => ({ ...f, [field]: val }))}
        copyTargets={getCopyTargets(currentGroup)}
        autoCopy={autoCopy}
        onAutoCopyChange={setAutoCopy}
      />

      {/* ── Toast ── */}
      {toast && <div className="cal-toast">{toast}</div>}
    </div>
  );
};

export default EditCalendarCoach;
