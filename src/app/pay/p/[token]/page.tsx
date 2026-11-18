import { notFound } from "next/navigation";
import PayCheckoutClient from "@/components/pay/PayCheckoutClient";
import { formatEventDateLabel } from "@/lib/data";
import { applyHoldExpiry, formatSeatLabel, quizHasStarted } from "@/lib/pay-domain";
import { payRequestContext } from "@/lib/pay-request";
import { findSeatByToken } from "@/lib/pay-storage";

export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

export default async function PaySeatPage({ params }: Props) {
  const found = await findSeatByToken(params.token);
  if (!found) notFound();

  const team = applyHoldExpiry(found.team);
  const seat = team.seats.find((s) => s.token === params.token) ?? found.seat;
  const { href } = payRequestContext();
  const whenLabel = `${formatEventDateLabel(team.quizDate)} · ${team.quizTime}`;

  let blockedMessage: string | undefined;
  if (seat.status === "void") {
    blockedMessage = "Toto miesto už nie je kúpiteľné online. Po štarte kvízu použi walk-up na mieste.";
  } else if (seat.status !== "paid" && seat.kind === "prepaid" && quizHasStarted(team.quizDate, team.quizTime)) {
    blockedMessage = "Kvíz už začal — online predaj nezaplatených miest skončil.";
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <PayCheckoutClient
        seatToken={params.token}
        amountEur={seat.amountEur}
        seatLabel={formatSeatLabel(seat)}
        teamName={team.teamName}
        venue={team.venue}
        whenLabel={whenLabel}
        teamHref={href(`/t/${team.token}`)}
        homeHref={href("/")}
        alreadyPaid={seat.status === "paid"}
        blockedMessage={blockedMessage}
      />
    </div>
  );
}
