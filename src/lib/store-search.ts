export type StoreSearchOption = {
  id: string;
  name: string;
  customer: string | null;
  code?: string | null;
};

export const STORE_SEARCH_RESULT_LIMIT = 50;
export const STORE_SEARCH_PAGE_SIZE = 1000;

export function normalizeStoreSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function buildStoreSearchTokens(query: string) {
  const foldedQuery = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const matches = foldedQuery.match(/[a-z]+|\d+/g) ?? [];

  return Array.from(new Set(matches.filter(Boolean)));
}

export function rankStoreSearchOptions(
  stores: StoreSearchOption[],
  rawQuery: string,
  limit = STORE_SEARCH_RESULT_LIMIT
) {
  const trimmedQuery = rawQuery.trim();

  if (!trimmedQuery) {
    return stores
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, limit);
  }

  const tokens = buildStoreSearchTokens(trimmedQuery);
  const normalizedQuery = normalizeStoreSearchText(trimmedQuery);

  return stores
    .map((store) => {
      const normalizedName = normalizeStoreSearchText(store.name);
      const normalizedCustomer = normalizeStoreSearchText(store.customer ?? "");
      const normalizedCode = normalizeStoreSearchText(store.code ?? "");
      const tokenMatches = tokens.filter(
        (token) =>
          normalizedName.includes(token) ||
          normalizedCustomer.includes(token) ||
          normalizedCode.includes(token)
      ).length;
      const namePhraseMatch = normalizedName.includes(normalizedQuery);
      const customerPhraseMatch = normalizedCustomer.includes(normalizedQuery);
      const codePhraseMatch = normalizedCode.includes(normalizedQuery);
      const allTokensMatch = tokens.length > 0 && tokenMatches === tokens.length;
      const startsWithQuery =
        normalizedName.startsWith(normalizedQuery) || normalizedCode.startsWith(normalizedQuery);

      return {
        store,
        score:
          (namePhraseMatch ? 500 : 0) +
          (codePhraseMatch ? 450 : 0) +
          (customerPhraseMatch ? 300 : 0) +
          (allTokensMatch ? 250 : 0) +
          (startsWithQuery ? 125 : 0) +
          tokenMatches * 50
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.store.name.localeCompare(right.store.name);
    })
    .slice(0, limit)
    .map((item) => item.store);
}
