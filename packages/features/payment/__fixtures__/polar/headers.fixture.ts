import crypto from "node:crypto";

/**
 * Build a valid set of Polar webhook headers for a given raw body + secret.
 *
 * Polar's `format=raw` webhook secret is the FULL string (incl. polar_whs_
 * prefix) used as the HMAC-SHA256 key. The signed payload is
 *   `${webhook-id}.${webhook-timestamp}.${rawBody}`
 * and the header value is `v1,<base64(hmac)>`.
 *
 * Used by:
 *   - controller spec for signature edge cases (Task 12)
 *   - integration test for end-to-end flow
 */
export interface PolarRawHeaderFixtureOpts {
  rawBody: string;
  secret: string;
  webhookId?: string;
  timestampSec?: number;
  /** When set, replaces the last 2 chars of the base64 sig with "AA" — used
   *  to produce a syntactically-valid but invalid signature. */
  tamperSig?: boolean;
  /** When set, prepends a second invalid sig (space-separated) before the
   *  real one — used to verify multi-signature handling. */
  prependDecoySig?: boolean;
}

export interface PolarRawHeaders {
  "webhook-id": string;
  "webhook-timestamp": string;
  "webhook-signature": string;
}

export function buildPolarRawHeaders(
  opts: PolarRawHeaderFixtureOpts,
): PolarRawHeaders {
  const id = opts.webhookId ?? "msg_fixture_1";
  const ts = opts.timestampSec ?? Math.floor(Date.now() / 1000);
  const signed = `${id}.${ts}.${opts.rawBody}`;
  let sig = crypto
    .createHmac("sha256", opts.secret)
    .update(signed)
    .digest("base64");
  if (opts.tamperSig) {
    sig = `${sig.slice(0, -2)}AA`;
  }
  let header = `v1,${sig}`;
  if (opts.prependDecoySig) {
    const decoy = crypto
      .createHmac("sha256", "wrong_secret")
      .update(signed)
      .digest("base64");
    header = `v1,${decoy} ${header}`;
  }
  return {
    "webhook-id": id,
    "webhook-timestamp": String(ts),
    "webhook-signature": header,
  };
}
