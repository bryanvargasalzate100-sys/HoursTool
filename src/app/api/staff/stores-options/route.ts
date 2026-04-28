import { requireStaffUser } from "@/lib/auth/require-staff-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type StoreOption = {
  id: string;
  name: string;
  customer: string | null;
};

function normalizeForSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildSearchTokens(query: string) {
  const matches = query.toLowerCase().match(/[a-z]+|\d+/g);
  return Array.from(new Set(matches?.filter(Boolean) ?? [query.toLowerCase()]));
}

export async function GET(request: Request) {
  const staffUser = await requireStaffUser({ onFail: "null" });

  if (!staffUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q")?.trim() ?? "";
  const admin = createAdminSupabaseClient();
  let query = admin.from("stores").select("id, name, customer").eq("is_active", true);

  if (!rawQuery) {
    const { data, error } = await query.order("name").range(0, 49);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data ?? []);
  }

  const tokens = buildSearchTokens(rawQuery);
  const orFilters = tokens.flatMap((token) => [`name.ilike.%${token}%`, `customer.ilike.%${token}%`]);
  const { data, error } = await query.or(orFilters.join(",")).order("name").range(0, 199);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const normalizedQuery = normalizeForSearch(rawQuery);
  const ranked = (data ?? [])
    .map((store: StoreOption) => {
      const normalizedName = normalizeForSearch(store.name);
      const normalizedCustomer = normalizeForSearch(store.customer ?? "");
      const tokenMatches = tokens.filter(
        (token) => normalizedName.includes(token) || normalizedCustomer.includes(token)
      ).length;
      const exactNormalizedMatch =
        normalizedName.includes(normalizedQuery) || normalizedCustomer.includes(normalizedQuery);

      return {
        store,
        score: (exactNormalizedMatch ? 100 : 0) + tokenMatches
      };
    })
    .sort((left, right) => right.score - left.score || left.store.name.localeCompare(right.store.name))
    .slice(0, 50)
    .map((item) => item.store);

  return Response.json(ranked);
}
