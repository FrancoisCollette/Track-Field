// useInfiniteCalendar.ts
// Hook gérant une fenêtre de dates "infinie" pour les calendriers coach et athlète.
// Principe : on part sur ±4 semaines autour d'aujourd'hui, et on peut étendre
// la fenêtre de 8 semaines vers le passé ou le futur à la demande.
// Le passé est bloqué au lundi 16 mars 2026 (date de début du projet — easter egg 🥚).

import { useState, useMemo, useCallback } from "react";
import { getMonday } from "../lib/calendarUtils";

// ─── Constantes ────────────────────────────────────────────────────────────────

// Taille d'un chunk : 8 semaines = 56 jours
const CHUNK_WEEKS = 8;

// Fenêtre initiale : -2 et +4 semaines de chaque côté d'aujourd'hui
const INITIAL_WEEKS_PAST = 2;
const INITIAL_WEEKS_FUTURE = 4;

// Date de début absolu : lundi 16 mars 2026 🥚
// On utilise midi UTC pour éviter tout décalage de timezone
const ABSOLUTE_START = new Date("2026-03-16T12:00:00Z");

// ─── Types exportés ────────────────────────────────────────────────────────────

export interface InfiniteCalendarRange {
  /** Toutes les dates de la fenêtre courante, jour par jour */
  dates: Date[];
  /** Mêmes dates regroupées par semaines de 7 jours (lun→dim) */
  weeks: Date[][];
  /** Peut-on encore charger des semaines passées ? */
  canLoadPast: boolean;
  /** Charge 8 semaines supplémentaires vers le passé */
  loadPast: () => void;
  /** Charge 8 semaines supplémentaires vers le futur */
  loadFuture: () => void;
  /** Date de début de la fenêtre courante */
  startDate: Date;
  /** Date de fin de la fenêtre courante */
  endDate: Date;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInfiniteCalendar(): InfiniteCalendarRange {
  const today = new Date();

  // On ancre toujours la fenêtre sur le lundi de la semaine courante
  const thisMonday = getMonday(today);

  // ── État : dates de début et de fin de la fenêtre affichée ──────────────────
  // startDate = lundi d'il y a INITIAL_WEEKS_PAST semaines
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - INITIAL_WEEKS_PAST * 7);
    return d;
  });

  // endDate = dimanche dans INITIAL_WEEKS_FUTURE semaines
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(thisMonday);
    // +FUTURE semaines, puis +6 jours pour atterrir sur le dimanche
    d.setDate(d.getDate() + INITIAL_WEEKS_FUTURE * 7 + 6);
    return d;
  });

  // ── canLoadPast : vrai si startDate est encore après la limite absolue ──────
  const canLoadPast = useMemo(() => {
    // On compare les timestamps — startDate doit être strictement après ABSOLUTE_START
    return startDate.getTime() > ABSOLUTE_START.getTime();
  }, [startDate]);

  // ── loadPast : étend la fenêtre de CHUNK_WEEKS semaines vers le passé ───────
  const loadPast = useCallback(() => {
    if (!canLoadPast) return;

    setStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - CHUNK_WEEKS * 7);

      // On ne remonte jamais avant ABSOLUTE_START
      // Si le nouveau startDate est avant la limite, on cale sur la limite
      if (d.getTime() < ABSOLUTE_START.getTime()) {
        // Recaler sur le lundi de ABSOLUTE_START pour rester propre
        return getMonday(ABSOLUTE_START);
      }
      return d;
    });
  }, [canLoadPast]);

  // ── loadFuture : étend la fenêtre de CHUNK_WEEKS semaines vers le futur ─────
  const loadFuture = useCallback(() => {
    setEndDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + CHUNK_WEEKS * 7);
      return d;
    });
  }, []);

  // ── Calcul des dates et semaines ────────────────────────────────────────────

  const dates = useMemo(() => {
    const result: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [startDate, endDate]);

  // On groupe les dates par semaines de 7 (pour la vue desktop)
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    // On avance de 7 en 7 dans le tableau dates
    for (let i = 0; i < dates.length; i += 7) {
      result.push(dates.slice(i, i + 7));
    }
    return result;
  }, [dates]);

  return {
    dates,
    weeks,
    canLoadPast,
    loadPast,
    loadFuture,
    startDate,
    endDate,
  };
}
