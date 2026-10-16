import { supabase } from "./supabaseClient";

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;

  const profile = await getProfileById(data.user.id);
  return { user: data.user, profile };
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfileById(user.id);
}

export async function getProfileById(id) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, division")
    .order("role");
  if (error) return [];
  return data || [];
}

export function signOut() {
  return supabase.auth.signOut();
}
