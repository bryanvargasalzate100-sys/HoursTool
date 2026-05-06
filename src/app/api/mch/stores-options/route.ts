import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  STORE_SEARCH_PAGE_SIZE,
  STORE_SEARCH_RESULT_LIMIT,
  type StoreSearchOption,
  rankStoreSearchOptions
} from "@/lib/store-search";

type StoreSearchError = {
  message: string;
};

function formatStoreOptions(stores: StoreSearchOption[]) {
  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    customer: store.customer
  }));
}

function isMissingSearchFunction(error: StoreSearchError & { code?: string }) {
  return error.code === "PGRST202" || error.message.includes("search_store_options");
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q")?.trim() ?? "";
  const { data: rpcData, error: rpcError } = await supabase.rpc("search_store_options", {
    max_results: STORE_SEARCH_RESULT_LIMIT,
    search_query: rawQuery
  });

  if (!rpcError) {
    return Response.json(formatStoreOptions((rpcData ?? []) as StoreSearchOption[]));
  }

  if (!isMissingSearchFunction(rpcError)) {
    return Response.json({ error: rpcError.message }, { status: 500 });
  }

  const stores: StoreSearchOption[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("stores")
      .select("id, name, customer, code")
      .eq("is_active", true)
      .order("name")
      .range(from, from + STORE_SEARCH_PAGE_SIZE - 1);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    stores.push(...((data ?? []) as StoreSearchOption[]));

    if (!data || data.length < STORE_SEARCH_PAGE_SIZE) {
      break;
    }

    from += STORE_SEARCH_PAGE_SIZE;
  }

  return Response.json(formatStoreOptions(rankStoreSearchOptions(stores, rawQuery)));
}
