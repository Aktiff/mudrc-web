"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  formatSkPlayerCountTotal,
  formatSkTeamCount,
  parseRegistrationPlayerCount,
  registrationShareText,
} from "@/lib/registration-utils";

type Team = { teamName: string; players: string | number };

type Props = {
  venue: string;
  city?: string;
  whenLabel?: string;
  teams: Team[];
};

export default function RegistrationShareList({ venue, city, whenLabel, teams }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = registrationShareText({ venue, city, whenLabel, teams });
  const rows = teams
    .map((team) => ({
      teamName: team.teamName.trim(),
      players: parseRegistrationPlayerCount(team.players),
    }))
    .filter((team) => team.teamName)
    .sort((a, b) => a.teamName.localeCompare(b.teamName, "sk"));

  const copy = async () => {
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
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="btn-outline text-sm py-2 px-4">
        {open ? "Skryť zoznam" : "Zoznam pre majiteľa"}
      </button>
      {open && (
        <div className="space-y-3">
          <button type="button" onClick={() => void copy()} className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Skopírované" : "Skopírovať"}
          </button>
          <div className="rounded-2xl border border-stone-200 bg-white text-stone-900 p-6 sm:p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">MUDRC kvíz</p>
            <h2 className="text-2xl font-bold mt-1">{venue}</h2>
            <p className="text-stone-600 text-sm mt-1">
              {[city, whenLabel].filter(Boolean).join(" · ")}
            </p>
            <p className="font-semibold mt-4">
              {formatSkTeamCount(rows.length)}
              {" · "}
              {formatSkPlayerCountTotal(rows.reduce((sum, team) => sum + team.players, 0))}
            </p>
            <ol className="mt-4 space-y-2">
              {rows.map((team, index) => (
                <li key={`${team.teamName}-${index}`} className="flex items-baseline justify-between gap-4 border-b border-stone-100 pb-2">
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
      )}
    </div>
  );
}
