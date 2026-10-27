import { normalizeDateKey } from "@/lib/quiz-result-key";

export type PollConfig = {
  eventSlug: string;
  venue: string;
  title: string;
  description: string;
  options: string[];
  active: boolean;
};

export type PollVote = {
  id: string;
  eventSlug: string;
  teamName: string;
  optionDates: string[];
  createdAt: string;
  updatedAt: string;
};

/** @deprecated starý formát — jeden termín na hlas */
export type LegacyPollVote = PollVote & { optionDate?: string };

export type PollPublicVote = {
  teamName: string;
  optionDates: string[];
};

export type PollPublicData = {
  config: PollConfig;
  votes: PollPublicVote[];
  totals: Record<string, number>;
  votedTeamKeys: string[];
  teamCount: number;
};

const SK_WEEKDAYS = ["nedeľa", "pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota"] as const;

export function normalizePollDateLabel(date: string): string {
  const parsed = parseSkDate(date);
  if (!parsed) return date.trim();
  return `${parsed.getDate()}.${parsed.getMonth() + 1}.${parsed.getFullYear()}`;
}

export function formatSkWeekday(date: string): string | null {
  const parsed = parseSkDate(date);
  if (!parsed) return null;
  return SK_WEEKDAYS[parsed.getDay()];
}

export function formatPollOptionLabel(date: string): string {
  const normalized = normalizePollDateLabel(date);
  const weekday = formatSkWeekday(normalized);
  return weekday ? `${weekday} - ${normalized}` : normalized;
}

export function pollOptionKey(date: string): string {
  const parsed = parseSkDate(date);
  if (!parsed) return normalizeDateKey(date);
  return `${parsed.getFullYear()}-${parsed.getMonth() + 1}-${parsed.getDate()}`;
}

export function pollOptionsMatch(a: string, b: string): boolean {
  return pollOptionKey(a) === pollOptionKey(b);
}

export function optionMatchesList(optionDate: string, options: string[]): boolean {
  return options.some((option) => pollOptionsMatch(option, optionDate));
}

export function canonicalPollOption(optionDate: string, options: string[]): string | null {
  return options.find((option) => pollOptionsMatch(option, optionDate)) ?? null;
}

export function normalizePollOptions(options: string[]): string[] {
  return sortPollOptions(
    Array.from(new Set(options.map(normalizePollDateLabel).filter(Boolean)))
  );
}

export function normalizeTeamName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function teamKey(name: string): string {
  return normalizeTeamName(name).toLowerCase();
}

/** Vráti nový názov, keď ide o ten istý tím. Inak nechá pôvodný zápis. */
export function replaceTeamLabel(name: string, fromKey: string, nextName: string): string {
  if (!name || teamKey(name) !== fromKey) return name;
  return nextName;
}

function parseSkDate(date: string): Date | null {
  const match = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function getTodayInBratislava(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(year, month - 1, day);
}

export function sortPollOptions(options: string[]): string[] {
  return [...options].sort((a, b) => {
    const dateA = parseSkDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
    const dateB = parseSkDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
    return dateA - dateB;
  });
}

export function filterUpcomingPollOptions(options: string[], today = getTodayInBratislava()): string[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return sortPollOptions(
    options.filter((option) => {
      const parsed = parseSkDate(option);
      if (!parsed) return false;
      return parsed >= startOfToday;
    })
  );
}

/** Všetky soboty v júni, júli a auguste. */
export function getSummerSaturdays(year: number): string[] {
  const dates: string[] = [];
  for (const month of [5, 6, 7]) {
    const cursor = new Date(year, month, 1);
    while (cursor.getMonth() === month) {
      if (cursor.getDay() === 6) {
        dates.push(`${cursor.getDate()}.${month + 1}.${year}`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return dates;
}

export const POLL_DISCLAIMER =
  "Nezáväzné hlasovanie o predbežný záujem — ešte to nie je registrácia na kvíz. Označte len termíny, kedy určite môžete prísť.";

export function createPollConfigForEvent(eventSlug: string, venue: string, active = false): PollConfig {
  return {
    eventSlug,
    venue,
    title: `Letný termín kvízu v ${venue}`,
    description:
      "V lete je kvízová pauza, ale ak by sa našlo dosť tímov, môžeme kvíz zorganizovať. Hlasuje jeden zástupca za tím — označte všetky termíny, kedy určite môžete prísť.",
    options: [],
    active,
  };
}
export const DEFAULT_POLL_CONFIGS: PollConfig[] = [
  {
    eventSlug: "alipub",
    venue: "Alipub",
    title: "Letný termín kvízu v Alipube",
    description:
      "V lete je kvízová pauza, ale ak by sa našlo dosť tímov, môžeme kvíz zorganizovať. Hlasuje jeden zástupca za tím — označte všetky termíny, kedy určite môžete prísť.",
    options: getSummerSaturdays(2026),
    active: true,
  },
];

export function getDefaultPollConfig(eventSlug: string): PollConfig | null {
  const config = DEFAULT_POLL_CONFIGS.find((entry) => entry.eventSlug === eventSlug);
  if (!config) return null;
  return {
    ...config,
    options: sortPollOptions(config.options),
  };
}

export function stablePollVoteId(vote: Pick<PollVote, "id" | "eventSlug" | "teamName">): string {
  if (vote.id?.trim()) return vote.id.trim();
  return `legacy-${vote.eventSlug}-${teamKey(vote.teamName)}`;
}

export function normalizePollVote(vote: LegacyPollVote): PollVote {
  const base = vote.optionDates?.length
    ? {
        eventSlug: vote.eventSlug,
        teamName: vote.teamName,
        optionDates: sortPollOptions(vote.optionDates.map(normalizePollDateLabel)),
        createdAt: vote.createdAt,
        updatedAt: vote.updatedAt,
      }
    : vote.optionDate
      ? {
          eventSlug: vote.eventSlug,
          teamName: vote.teamName,
          optionDates: [normalizePollDateLabel(vote.optionDate)],
          createdAt: vote.createdAt,
          updatedAt: vote.updatedAt,
        }
      : {
          eventSlug: vote.eventSlug,
          teamName: vote.teamName,
          optionDates: [],
          createdAt: vote.createdAt,
          updatedAt: vote.updatedAt,
        };

  return {
    id: stablePollVoteId({ id: vote.id, eventSlug: vote.eventSlug, teamName: vote.teamName }),
    ...base,
  };
}

export function getVoteOptionDates(vote: LegacyPollVote): string[] {
  return normalizePollVote(vote).optionDates;
}

export function buildPollPublicData(config: PollConfig, votes: LegacyPollVote[]): PollPublicData {
  const normalizedConfigOptions = normalizePollOptions(config.options);
  const upcomingOptions = filterUpcomingPollOptions(normalizedConfigOptions);
  const upcomingByKey = new Map(upcomingOptions.map((option) => [pollOptionKey(option), option]));
  const normalizedVotes = votes.map(normalizePollVote);
  const totals: Record<string, number> = {};
  for (const option of upcomingOptions) totals[option] = 0;

  const teamVotes = new Map<string, PollPublicVote>();
  for (const vote of normalizedVotes) {
    const key = teamKey(vote.teamName);
    const visibleDates = sortPollOptions(
      vote.optionDates
        .map((optionDate) => upcomingByKey.get(pollOptionKey(optionDate)))
        .filter((optionDate): optionDate is string => !!optionDate)
    );
    if (visibleDates.length === 0) continue;

    teamVotes.set(key, { teamName: vote.teamName, optionDates: visibleDates });
    for (const optionDate of visibleDates) {
      totals[optionDate] = (totals[optionDate] ?? 0) + 1;
    }
  }

  const publicVotes = Array.from(teamVotes.values()).sort((a, b) =>
    a.teamName.localeCompare(b.teamName, "sk")
  );

  return {
    config: { ...config, options: upcomingOptions },
    votes: publicVotes,
    totals,
    votedTeamKeys: publicVotes.map((vote) => teamKey(vote.teamName)),
    teamCount: publicVotes.length,
  };
}
