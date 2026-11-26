"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  formatSkPlayerCountTotal,
  formatSkTeamCount,
  parseRegistrationPlayerCount,
  registrationShareText,
} from "@/lib/registration-utils";

type Team = { teamName: string; players: string | number };

export type ShareListGroup = {
  key: string;
  whenLabel?: string;
  teams: Team[];
};

type Props = {
  venue: string;
  city?: string;
  whenLabel?: string;
  teams?: Team[];
  groups?: ShareListGroup[];
};

const ALL_TERMS_KEY = "__all__";

function formatSkTermCount(count: number): string {
  if (count === 1) return "1 termín";
  if (count >= 2 && count <= 4) return `${count} termíny`;
  return `${count} termínov`;
}

export default function RegistrationShareList({ venue, city, whenLabel, teams, groups }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>(ALL_TERMS_KEY);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const resolvedGroups = useMemo(() => {
    const rawGroups: ShareListGroup[] =
      groups ?? (teams ? [{ key: "single", whenLabel, teams }] : []);
    return rawGroups
      .map((group) => {
        const rows = group.teams
          .map((team) => ({
            teamName: team.teamName.trim(),
            players: parseRegistrationPlayerCount(team.players),
          }))
          .filter((team) => team.teamName)
          .sort((a, b) => a.teamName.localeCompare(b.teamName, "sk"));
        return {
          key: group.key,
          whenLabel: group.whenLabel,
          rows,
          playerTotal: rows.reduce((sum, team) => sum + team.players, 0),
          text: registrationShareText({
            venue,
            city,
            whenLabel: group.whenLabel,
            teams: group.teams,
          }),
        };
      })
      .filter((group) => group.rows.length > 0);
  }, [groups, teams, whenLabel, venue, city]);

  const effectiveKey =
    selectedKey === ALL_TERMS_KEY || resolvedGroups.some((group) => group.key === selectedKey)
      ? selectedKey
      : ALL_TERMS_KEY;

  const visibleGroups =
    resolvedGroups.length <= 1 || effectiveKey === ALL_TERMS_KEY
      ? resolvedGroups
      : resolvedGroups.filter((group) => group.key === effectiveKey);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopiedKey(key);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
      copyTimerRef.current = null;
    }, 2000);
  };

  if (resolvedGroups.length === 0) return null;

  const hasMultiple = resolvedGroups.length > 1;
  const toggleLabel = hasMultiple
    ? open
      ? "Skryť zoznamy"
      : `Zoznam pre majiteľa (${formatSkTermCount(resolvedGroups.length)})`
    : open
      ? "Skryť zoznam"
      : "Zoznam pre majiteľa";

  return (
    <div className="space-y-3 mb-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="btn-outline text-sm py-2 px-4">
        {toggleLabel}
      </button>
      {open && (
        <div className="space-y-4">
          {hasMultiple && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Výber termínu pre zoznam majiteľa">
              <button
                type="button"
                aria-pressed={effectiveKey === ALL_TERMS_KEY}
                onClick={() => setSelectedKey(ALL_TERMS_KEY)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  effectiveKey === ALL_TERMS_KEY
                    ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                    : "border-brand-border text-brand-muted hover:border-brand-orange hover:text-brand-text"
                }`}
              >
                Všetky termíny ({resolvedGroups.length})
              </button>
              {resolvedGroups.map((group) => {
                const active = effectiveKey === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedKey(group.key)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      active
                        ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                        : "border-brand-border text-brand-muted hover:border-brand-orange hover:text-brand-text"
                    }`}
                  >
                    {group.whenLabel || "Termín"} ({group.rows.length})
                  </button>
                );
              })}
            </div>
          )}

          {visibleGroups.map((group) => {
            const isCopied = copiedKey === group.key;
            return (
              <div key={group.key} className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {hasMultiple && group.whenLabel ? (
                    <span className="text-sm font-semibold text-brand-text">{group.whenLabel}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void copy(group.key, group.text)}
                    className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2"
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? "Skopírované" : "Skopírovať"}
                  </button>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white text-stone-900 p-6 sm:p-8 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">MUDRC kvíz</p>
                  <h2 className="text-2xl font-bold mt-1">{venue}</h2>
                  <p className="text-stone-600 text-sm mt-1">
                    {[city, group.whenLabel].filter(Boolean).join(" · ")}
                  </p>
                  <p className="font-semibold mt-4">
                    {formatSkTeamCount(group.rows.length)}
                    {" · "}
                    {formatSkPlayerCountTotal(group.playerTotal)}
                  </p>
                  <ol className="mt-4 space-y-2">
                    {group.rows.map((team, index) => (
                      <li
                        key={`${team.teamName}-${index}`}
                        className="flex items-baseline justify-between gap-4 border-b border-stone-100 pb-2"
                      >
                        <span className="font-semibold">
                          {index + 1}. {team.teamName}
                        </span>
                        <span className="text-stone-600 text-sm whitespace-nowrap">
                          {team.players > 0 ? formatSkPlayerCountTotal(team.players) : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
