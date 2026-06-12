"use client";

import type { MouseEvent } from "react";
import {
  addressesForRow,
  contactLinksForRow,
  emailsForRow,
  phonesForRow,
  safeTelHref,
  socialLinksForRow,
} from "@/lib/evalLocal/contactExtractionParse";
import { offeringsForRow } from "@/lib/evalLocal/offeringsExtractionParse";
import type { ReviewQueueRow } from "@/lib/evalLocal/reviewQueueTypes";
import { EVAL_TABLE_CLAMP_3_CLASS, EVAL_TABLE_TRUNCATE_CLASS } from "./evalTableLayout";

const LINK_CLASS =
  "text-inherit decoration-transparent hover:underline hover:decoration-zinc-300 underline-offset-2";

function stopRowExpand(e: MouseEvent) {
  e.stopPropagation();
}

export function EmailListCell({
  row,
  max = 2,
  emptyLabel = "No email",
}: {
  row: ReviewQueueRow;
  max?: number;
  emptyLabel?: string;
}) {
  const emails = emailsForRow(row);
  if (emails.length === 0) {
    return <span className="text-[11px] text-zinc-400">{emptyLabel}</span>;
  }

  const shown = emails.slice(0, max);
  const extra = emails.length - shown.length;

  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-[11px]">
      {shown.map((email) => (
        <a
          key={email}
          href={`mailto:${email}`}
          className={`${EVAL_TABLE_TRUNCATE_CLASS} font-mono text-zinc-700 ${LINK_CLASS}`}
          title={email}
          onClick={stopRowExpand}
        >
          {email}
        </a>
      ))}
      {extra > 0 ? (
        <span className="text-[10px] text-zinc-400">+{extra}</span>
      ) : null}
    </div>
  );
}

export function PhoneListCell({
  row,
  max = 2,
  emptyLabel = "No phone",
}: {
  row: ReviewQueueRow;
  max?: number;
  emptyLabel?: string;
}) {
  const phones = phonesForRow(row);
  if (phones.length === 0) {
    return <span className="text-[11px] text-zinc-400">{emptyLabel}</span>;
  }

  const shown = phones.slice(0, max);
  const extra = phones.length - shown.length;

  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-[11px]">
      {shown.map((phone) => {
        const tel = safeTelHref(phone);
        if (tel) {
          return (
            <a
              key={phone}
              href={tel}
              className={`${EVAL_TABLE_TRUNCATE_CLASS} text-zinc-700 ${LINK_CLASS}`}
              title={phone}
              onClick={stopRowExpand}
            >
              {phone}
            </a>
          );
        }
        return (
          <span
            key={phone}
            className={`${EVAL_TABLE_TRUNCATE_CLASS} text-zinc-700`}
            title={phone}
          >
            {phone}
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="text-[10px] text-zinc-400">+{extra}</span>
      ) : null}
    </div>
  );
}

export function SocialLinksCell({
  row,
  max = 3,
  emptyLabel = "No social",
}: {
  row: ReviewQueueRow;
  max?: number;
  emptyLabel?: string;
}) {
  const links = socialLinksForRow(row);
  if (links.length === 0) {
    return <span className="text-[11px] text-zinc-400">{emptyLabel}</span>;
  }

  const shown = links.slice(0, max);
  const extra = links.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
      {shown.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noreferrer noopener"
          className={`text-zinc-700 ${LINK_CLASS}`}
          onClick={stopRowExpand}
        >
          {link.label}
        </a>
      ))}
      {extra > 0 ? (
        <span className="text-[10px] text-zinc-400">+{extra}</span>
      ) : null}
    </div>
  );
}

export function OfferingsListCell({
  row,
  max = 3,
  emptyLabel = "No products/services",
}: {
  row: ReviewQueueRow;
  max?: number;
  emptyLabel?: string;
}) {
  const items = offeringsForRow(row);
  if (items.length === 0) {
    return <span className="text-[11px] text-zinc-400">{emptyLabel}</span>;
  }

  const shown = items.slice(0, max);
  const extra = items.length - shown.length;

  return (
    <div className={`flex min-w-0 flex-col gap-0.5 text-[11px] text-zinc-700 ${EVAL_TABLE_CLAMP_3_CLASS}`}>
      {shown.map((item) => (
        <span key={item} className={EVAL_TABLE_TRUNCATE_CLASS} title={item}>
          {item}
        </span>
      ))}
      {extra > 0 ? (
        <span className="text-[10px] text-zinc-400">+{extra}</span>
      ) : null}
    </div>
  );
}

export function ContactLinksCell({
  row,
  max = 2,
  emptyLabel = "No links",
}: {
  row: ReviewQueueRow;
  max?: number;
  emptyLabel?: string;
}) {
  const links = contactLinksForRow(row);
  if (links.length === 0) {
    return <span className="text-[11px] text-zinc-400">{emptyLabel}</span>;
  }

  const shown = links.slice(0, max);
  const extra = links.length - shown.length;

  return (
    <div className="flex flex-col gap-0.5 text-[11px]">
      {shown.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noreferrer noopener"
          className={`break-all text-zinc-700 ${LINK_CLASS}`}
          onClick={stopRowExpand}
        >
          {link.label ? `${link.label}: ` : ""}{link.url}
        </a>
      ))}
      {extra > 0 ? (
        <span className="text-[10px] text-zinc-400">+{extra}</span>
      ) : null}
    </div>
  );
}

export function AddressCell({
  row,
  maxLen = 48,
  emptyLabel = "No address",
}: {
  row: ReviewQueueRow;
  maxLen?: number;
  emptyLabel?: string;
}) {
  const addresses = addressesForRow(row);
  if (addresses.length === 0) {
    return <span className="text-[11px] text-zinc-400">{emptyLabel}</span>;
  }

  const full = addresses.join(" · ");
  const display =
    full.length <= maxLen ? full : `${full.slice(0, maxLen - 1)}…`;

  return (
    <span className="text-[11px] text-zinc-700" title={full}>
      {display}
    </span>
  );
}
