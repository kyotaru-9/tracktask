import { useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import {
  fetchDocuments,
  fetchNotifications,
} from "../services/documentService";
import { fetchProfiles } from "../services/authService";

// Live documents + notifications + staff directory for the signed-in profile.
export default function useDashboardData(profile) {
  const [docs, setDocs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshDocs = useCallback(async () => {
    try {
      setDocs(await fetchDocuments());
    } catch (e) {
      console.error("fetchDocuments failed:", e);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!profile) return;
    try {
      setNotifications(await fetchNotifications(profile.id));
    } catch (e) {
      console.error("fetchNotifications failed:", e);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let mounted = true;

    (async () => {
      try {
        const [d, n, p] = await Promise.all([
          fetchDocuments(),
          fetchNotifications(profile.id),
          fetchProfiles(),
        ]);
        if (!mounted) return;
        setDocs(d);
        setNotifications(n);
        setProfiles(p);
      } catch (e) {
        console.error("initial load failed:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`dashboard-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, refreshDocs)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_steps" }, refreshDocs)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        refreshNotifications
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [profile, refreshDocs, refreshNotifications]);

  return {
    docs,
    notifications,
    profiles,
    loading,
    refreshDocs,
    refreshNotifications,
    setNotifications,
  };
}
