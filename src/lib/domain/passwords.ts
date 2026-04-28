import { getLastThreeDigits, normalizeNamePart } from "@/lib/utils";

export function buildInitialMchPassword(params: {
  firstName: string;
  lastName: string;
  staffingCode: string;
}) {
  const first = normalizeNamePart(params.firstName);
  const last = normalizeNamePart(params.lastName);
  const lastThree = getLastThreeDigits(params.staffingCode);

  return `${last}${first}-${lastThree}**`;
}
