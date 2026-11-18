/** Python number semantics the calculators rely on: round() (half to even on the exact binary value) and
 * "%"-format specs. JS Math.round / toFixed round ties differently. */

function isExactTie(x: number, ndigits: number): boolean {
  // toFixed(100) is the exact decimal expansion for the magnitudes used here
  const exact = Math.abs(x).toFixed(100);
  const frac = exact.split(".")[1];
  return frac[ndigits] === "5" && /^0*$/.test(frac.slice(ndigits + 1));
}

/** Python round(x, ndigits) as a decimal string with exactly ndigits decimals. */
export function pyRoundStr(x: number, ndigits = 0): string {
  if (!Number.isFinite(x)) throw new Error("cannot round non-finite value");
  let s = Math.abs(x).toFixed(ndigits); // correct except on exact ties (where toFixed rounds up)
  if (isExactTie(x, ndigits)) {
    const down = Math.abs(x).toFixed(ndigits + 1).slice(0, -1).replace(/\.$/, "");
    const lastDigit = Number(down.replace(".", "").slice(-1));
    s = lastDigit % 2 === 0 ? down : s; // half to even
  }
  return (x < 0 && Number(s) !== 0 ? "-" : "") + s;
}

/** Python round(x) / round(x, ndigits). */
export const pyRound = (x: number, ndigits = 0): number => Number(pyRoundStr(x, ndigits));

/** Python f"{x:.{d}%}". */
export const pyPct = (x: number, d: number): string => pyRoundStr(x * 100, d) + "%";

/** Python sum(): left to right from 0. */
export const pySum = (xs: Iterable<number>): number => {
  let t = 0;
  for (const x of xs) t += x;
  return t;
};
