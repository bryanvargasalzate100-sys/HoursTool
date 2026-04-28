"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

import { requireStaffUser } from "@/lib/auth/require-staff-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { storeSchema } from "@/lib/validation";

type StoreImportRow = {
  name: string;
  customer: string;
};

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function extractStoreRows(rows: unknown[]): StoreImportRow[] {
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const record = row as Record<string, unknown>;
      const name = normalizeCell(record.store ?? record.store_name ?? record.name ?? record.tienda);
      const customer = normalizeCell(
        record.customer ?? record.customer_name ?? record.client ?? record.cliente
      );

      if (!name || !customer) {
        return null;
      }

      return {
        name,
        customer
      };
    })
    .filter((row): row is StoreImportRow => Boolean(row));
}

export async function createStoreAction(formData: FormData) {
  await requireStaffUser();

  const parsed = storeSchema.parse({
    name: formData.get("name"),
    customer: formData.get("customer")
  });

  const admin = createAdminSupabaseClient();
  const normalizedName = parsed.name.trim().toLowerCase();
  const { data: existingStore, error: lookupError } = await admin
    .from("stores")
    .select("id")
    .ilike("name", normalizedName)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const payload = {
    name: parsed.name,
    customer: parsed.customer
  };

  const { error } = existingStore
    ? await admin.from("stores").update(payload).eq("id", existingStore.id)
    : await admin.from("stores").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/staff/stores");
  revalidatePath("/staff/users");
}

export async function uploadStoresAction(formData: FormData) {
  await requireStaffUser();

  const file = formData.get("stores-file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Select a CSV or Excel file before uploading.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  const storeRows = extractStoreRows(rows);

  if (storeRows.length === 0) {
    throw new Error("No valid stores were found in the uploaded file.");
  }

  const admin = createAdminSupabaseClient();
  const { data: existingStores, error: existingStoresError } = await admin
    .from("stores")
    .select("id, name");

  if (existingStoresError) {
    throw new Error(existingStoresError.message);
  }

  const existingStoreMap = new Map(
    (existingStores ?? []).map((store) => [store.name.trim().toLowerCase(), store.id])
  );

  for (const row of storeRows) {
    const existingStoreId = existingStoreMap.get(row.name.trim().toLowerCase());
    const payload = {
      name: row.name,
      customer: row.customer
    };

    if (existingStoreId) {
      const { error } = await admin.from("stores").update(payload).eq("id", existingStoreId);

      if (error) {
        throw new Error(error.message);
      }

      continue;
    }

    const { data: insertedStore, error } = await admin
      .from("stores")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    existingStoreMap.set(row.name.trim().toLowerCase(), insertedStore.id);
  }

  revalidatePath("/staff/stores");
  revalidatePath("/staff/users");
}
