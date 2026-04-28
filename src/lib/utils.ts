export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function normalizeNamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function buildFullName(firstName: string, lastName: string) {
  return `${lastName.trim()} ${firstName.trim()}`.trim();
}

export function getLastThreeDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.slice(-3).padStart(3, "0");
}
