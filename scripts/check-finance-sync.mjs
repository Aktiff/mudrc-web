/**
 * Unit checks for GET /api/finance/expected-incomes business logic.
 * Run: node scripts/check-finance-sync.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const runner = path.join(root, "scripts/.run-finance-sync-checks.ts");

fs.writeFileSync(
  runner,
  `
import assert from "node:assert/strict";
import {
  bratislavaTodayIso,
  buildFinanceExpectedIncomes,
  skDateToIso,
  verifyFinanceBearerToken,
} from "../src/lib/finance-sync";
import type { QuizEvent } from "../src/lib/data";
import type { PayTeam } from "../src/lib/pay-domain";
import type { Registration } from "../src/lib/storage";

// 1. Bearer auth checks
assert.deepEqual(verifyFinanceBearerToken("Bearer abc", undefined), {
  ok: false,
  status: 503,
  error: "FINANCE_SYNC_TOKEN nie je nakonfigurovaný.",
});
assert.equal(verifyFinanceBearerToken(null, "secret-token").ok, false);
assert.equal(verifyFinanceBearerToken("Basic abc", "secret-token").ok, false);
assert.equal(verifyFinanceBearerToken("Bearer wrong", "secret-token").ok, false);
assert.equal(verifyFinanceBearerToken("Bearer secret-tokeX", "secret-token").ok, false);
assert.deepEqual(verifyFinanceBearerToken("Bearer secret-token", "secret-token"), { ok: true });
assert.deepEqual(verifyFinanceBearerToken("bearer   secret-token  ", "secret-token"), { ok: true });

// 2. Date & Bratislava timezone checks
assert.equal(skDateToIso("7.11.2026"), "2026-11-07");
assert.equal(skDateToIso("31.12.2026"), "2026-12-31");
assert.equal(skDateToIso("31.02.2026"), null);
assert.equal(skDateToIso(""), null);
// 23:30 UTC on Nov 26 is already 00:30 CET on Nov 27 in Europe/Bratislava
assert.equal(bratislavaTodayIso(new Date("2026-11-26T23:30:00Z")), "2026-11-27");

// 3. Expected incomes aggregation, filtering, dedupe, pay merge, recent_played & zero PII
const baseEvent = (overrides: Partial<QuizEvent>): QuizEvent => ({
  slug: "lili-cafe",
  venue: "Lili Cafe",
  city: "Oslany",
  address: "Namestie 1",
  date: "27.11.2026",
  time: "19:00",
  entryFee: 4,
  maxPlayers: 8,
  minPlayers: 2,
  rounds: 4,
  questions: 55,
  durationMinutes: 120,
  active: true,
  leagueTable: [],
  pastResults: [],
  ...overrides,
});

const events: QuizEvent[] = [
  baseEvent({
    slug: "lili-cafe",
    venue: "Lili Cafe",
    city: "Oslany",
    date: "27.11.2026",
    time: "19:00",
    entryFee: 4,
    futureQuizzes: [
      { id: "2026-12-04", date: "04.12.2026", time: "20:00", quizType: "Hudobný kvíz" },
      { id: "2026-12-11", date: "11.12.2026", time: "19:00", quizType: "Všeobecný kvíz" },
    ],
    pastResults: [
      {
        id: "2026-11-20",
        date: "20.11.2026",
        winnerTeam: "TajnyVitaz",
        points: 42,
        teams: [
          { teamName: "TajnyVitaz", rounds: [10], total: 42, ligaPoints: 5, players: 4 },
          { teamName: "DruhyTim", rounds: [8], total: 35, ligaPoints: 4, players: 6 },
        ],
      },
      // Estimated only (no players on teams, no playerCount) -> must be skipped
      {
        id: "2026-11-18",
        date: "18.11.2026",
        winnerTeam: "OdhadTim",
        points: 30,
        teams: [{ teamName: "OdhadTim", rounds: [10], total: 30, ligaPoints: 2 }],
      },
      // Older than 14 days -> must be skipped
      {
        id: "2026-10-15",
        date: "15.10.2026",
        winnerTeam: "StaryTim",
        points: 30,
        playerCount: 20,
      },
    ],
  }),
  baseEvent({
    slug: "alipub",
    venue: "Alipub",
    city: "Prievidza",
    date: "26.11.2026", // today -> must be included
    time: "18:30",
    entryFee: 4.5,
  }),
  // External event -> skipped
  baseEvent({
    slug: "silvester-2026",
    venue: "Silvestrovský kvíz",
    externalUrl: "https://events.novella.sk/example",
    entryFee: 10,
    date: "31.12.2026",
  }),
  // Staging/test event -> skipped
  baseEvent({
    slug: "test-platby-silvester",
    venue: "TEST Platby — Silvester",
    entryFee: 4,
    date: "31.12.2026",
  }),
  // Inactive event -> skipped
  baseEvent({
    slug: "inactive-pub",
    venue: "Inactive Pub",
    active: false,
    entryFee: 4,
    date: "28.11.2026",
  }),
  // Zero-fee event -> skipped
  baseEvent({
    slug: "free-pub",
    venue: "Free Pub",
    entryFee: 0,
    date: "28.11.2026",
  }),
];

const registrations: Registration[] = [
  // Duplicate for same team on nearest term -> newer (6 players) wins over older (4 players)
  {
    id: "r1-old",
    eventSlug: "lili-cafe",
    venue: "Lili Cafe",
    teamName: "SuperTim",
    players: "4",
    phone: "+421900111222",
    createdAt: "25. 11. 2026, 10:00:00",
  },
  {
    id: "r1-new",
    eventSlug: "lili-cafe",
    venue: "Lili Cafe",
    teamName: "SuperTim",
    players: "6",
    phone: "+421900111222",
    createdAt: "26. 11. 2026, 10:00:00",
  },
  // Second team on nearest term
  {
    id: "r2",
    eventSlug: "lili-cafe",
    venue: "Lili Cafe",
    teamName: "BystreHlavy",
    players: "4 hráči",
    phone: "+421900333444",
    createdAt: "26. 11. 2026, 11:00:00",
  },
  // Team on futureQuiz 04.12.2026
  {
    id: "r3",
    eventSlug: "lili-cafe",
    venue: "Lili Cafe",
    teamName: "Hudobnici",
    players: "5",
    phone: "+421900555666",
    createdAt: "26. 11. 2026, 12:00:00",
    quizDate: "04.12.2026",
  },
  // Past term registration -> skipped
  {
    id: "r-past",
    eventSlug: "lili-cafe",
    venue: "Lili Cafe",
    teamName: "MinulyTim",
    players: "4",
    phone: "+421900777888",
    createdAt: "10. 11. 2026, 12:00:00",
    quizDate: "20.11.2026",
  },
  // Today's quiz on alipub (legacy missing eventSlug -> matched by venue)
  {
    id: "r-today",
    eventSlug: "",
    venue: "Alipub",
    teamName: "DnesnyTim",
    players: "4",
    phone: "+421900999000",
    createdAt: "26. 11. 2026, 09:00:00",
  },
  // Registrations on excluded events -> must not appear
  {
    id: "r-ext",
    eventSlug: "silvester-2026",
    venue: "Silvestrovský kvíz",
    teamName: "ExtTim",
    players: "4",
    phone: "+421911111111",
    createdAt: "26. 11. 2026, 09:00:00",
  },
  {
    id: "r-test",
    eventSlug: "test-platby-silvester",
    venue: "TEST Platby — Silvester",
    teamName: "TestTim",
    players: "4",
    phone: "+421922222222",
    createdAt: "26. 11. 2026, 09:00:00",
  },
  {
    id: "r-inactive",
    eventSlug: "inactive-pub",
    venue: "Inactive Pub",
    teamName: "InactiveTim",
    players: "4",
    phone: "+421933333333",
    createdAt: "26. 11. 2026, 09:00:00",
  },
];

const payTeams: PayTeam[] = [
  // Real prepaid team on lili-cafe nearest term: 3 seats (2 paid, 1 pending)
  {
    id: "pt-real",
    token: "secret-team-token",
    eventSlug: "lili-cafe",
    venue: "Lili Cafe",
    quizDate: "27.11.2026",
    quizTime: "19:00",
    teamName: "PrepaidTim",
    captainEmail: "kapitan@example.com",
    captainPhone: "+421944444444",
    players: 3,
    entryFee: 4,
    walkUpPrice: 6,
    status: "partially_paid",
    createdAt: "2026-11-26T08:00:00.000Z",
    mock: false,
    seats: [
      { id: "s1", token: "st1", index: 1, kind: "prepaid", status: "paid", amountEur: 4, payerName: "Janko Hrasko", payerEmail: "janko@example.com" },
      { id: "s2", token: "st2", index: 2, kind: "prepaid", status: "paid", amountEur: 4 },
      { id: "s3", token: "st3", index: 3, kind: "prepaid", status: "pending_payment", amountEur: 4 },
    ],
  },
  // Stray mock team on real event -> must be ignored!
  {
    id: "pt-stray-mock",
    token: "mock-token",
    eventSlug: "lili-cafe",
    venue: "Lili Cafe",
    quizDate: "27.11.2026",
    quizTime: "19:00",
    teamName: "MockLeakTim",
    captainEmail: "mock@example.com",
    players: 8,
    entryFee: 4,
    walkUpPrice: 6,
    status: "paid",
    createdAt: "2026-11-26T08:05:00.000Z",
    mock: true,
    seats: [],
  },
  // Cancelled pay team -> must be ignored!
  {
    id: "pt-cancelled",
    token: "cancel-token",
    eventSlug: "lili-cafe",
    venue: "Lili Cafe",
    quizDate: "27.11.2026",
    quizTime: "19:00",
    teamName: "CancelledTim",
    captainEmail: "cancel@example.com",
    players: 5,
    entryFee: 4,
    walkUpPrice: 6,
    status: "cancelled",
    createdAt: "2026-11-26T08:10:00.000Z",
    mock: false,
    seats: [],
  },
];

const result = buildFinanceExpectedIncomes({
  events,
  registrations,
  payTeams,
  now: new Date("2026-11-26T18:00:00Z"), // 19:00 CET in Bratislava
});

assert.equal(result.currency, "EUR");
assert.equal(result.generated_at, "2026-11-26T19:00:00+01:00");
assert.equal(result.upcoming.length, 3);

// Term 1: alipub today (4 players * 4.5 = 18)
assert.deepEqual(result.upcoming[0], {
  external_key: "mudrc:alipub:2026-11-26",
  event_slug: "alipub",
  venue: "Alipub",
  city: "Prievidza",
  quiz_type: "Všeobecný kvíz",
  expected_date: "2026-11-26",
  time: "18:30",
  entry_fee: 4.5,
  teams_count: 1,
  players_count: 4,
  estimated_amount: 18,
  paid_seats: 0,
  pending_seats: 0,
});

// Term 2: lili-cafe 27.11.2026 (6 + 4 + 3 = 13 players * 4 = 52; 2 paid, 1 pending)
assert.deepEqual(result.upcoming[1], {
  external_key: "mudrc:lili-cafe:2026-11-27",
  event_slug: "lili-cafe",
  venue: "Lili Cafe",
  city: "Oslany",
  quiz_type: "Všeobecný kvíz",
  expected_date: "2026-11-27",
  time: "19:00",
  entry_fee: 4,
  teams_count: 3,
  players_count: 13,
  estimated_amount: 52,
  paid_seats: 2,
  pending_seats: 1,
});

// Term 3: lili-cafe futureQuiz 04.12.2026 (5 players * 4 = 20; 11.12.2026 had 0 teams so skipped)
assert.deepEqual(result.upcoming[2], {
  external_key: "mudrc:lili-cafe:2026-12-04",
  event_slug: "lili-cafe",
  venue: "Lili Cafe",
  city: "Oslany",
  quiz_type: "Hudobný kvíz",
  expected_date: "2026-12-04",
  time: "20:00",
  entry_fee: 4,
  teams_count: 1,
  players_count: 5,
  estimated_amount: 20,
  paid_seats: 0,
  pending_seats: 0,
});

// Totals match sum of upcoming
assert.deepEqual(result.totals, {
  upcoming_terms: 3,
  teams_count: 5,
  players_count: 22,
  estimated_amount: 90,
});

// recent_played: only 20.11.2026 (10 players * 4 = 40)
assert.equal(result.recent_played.length, 1);
assert.deepEqual(result.recent_played[0], {
  external_key: "mudrc:lili-cafe:2026-11-20",
  event_slug: "lili-cafe",
  venue: "Lili Cafe",
  city: "Oslany",
  quiz_type: "Všeobecný kvíz",
  expected_date: "2026-11-20",
  entry_fee: 4,
  teams_count: 2,
  players_count: 10,
  actual_amount: 40,
});

// Zero PII check across entire serialized JSON
const serialized = JSON.stringify(result);
for (const forbidden of [
  "+421",
  "900111222",
  "kapitan@example.com",
  "janko@example.com",
  "Janko Hrasko",
  "SuperTim",
  "BystreHlavy",
  "PrepaidTim",
  "TajnyVitaz",
  "secret-team-token",
  "silvester-2026",
  "test-platby-silvester",
  "inactive-pub",
  "free-pub",
]) {
  assert.equal(serialized.includes(forbidden), false, \`PII or excluded data leaked: \${forbidden}\`);
}

console.log("All finance-sync checks passed.");
`,
  "utf8"
);

const result = spawnSync("npx", ["--yes", "tsx", runner], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
  env: process.env,
});

fs.unlinkSync(runner);
process.exit(result.status ?? 1);
