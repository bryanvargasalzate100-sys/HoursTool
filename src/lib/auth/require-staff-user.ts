"use server";

import { redirect } from "next/navigation";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RequireStaffUserOptions = {
  onFail?: "redirect" | "throw" | "null";
};

type StaffProfile = {
  id: string;
  role: string;
  email: string;
};

export async function requireStaffUser(): Promise<StaffProfile>;
export async function requireStaffUser(
  options: { onFail: "redirect" | "throw" }
): Promise<StaffProfile>;
export async function requireStaffUser(
  options: { onFail: "null" }
): Promise<StaffProfile | null>;
export async function requireStaffUser(
  options: RequireStaffUserOptions = {}
): Promise<StaffProfile | null> {
  const onFail = options.onFail ?? "redirect";
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    if (onFail === "redirect") {
      redirect("/staff/login?reason=expired");
    }

    if (onFail === "null") {
      return null;
    }

    throw new Error("Your session expired. Sign in again as a staff user.");
  }

  const admin = createAdminSupabaseClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    if (onFail === "redirect") {
      redirect("/staff/login?reason=expired");
    }

    if (onFail === "null") {
      return null;
    }

    throw new Error("No staff profile is linked to this session.");
  }

  if (profile.role !== "staff") {
    if (onFail === "redirect") {
      redirect("/staff/login?reason=forbidden");
    }

    if (onFail === "null") {
      return null;
    }

    throw new Error("This action is only available to staff users.");
  }

  return profile;
}
