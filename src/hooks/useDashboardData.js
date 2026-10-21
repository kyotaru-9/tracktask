import { useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import {
  fetchDocuments,
  fetchNotifications,
  fetchSharedDocuments,
} from "../services/documentService";
import { fetchProfiles } from "../services/authService";

// Live documents + notifications + staff directory for the signed-in profile.
export default function useDashboardData(profile) {
  const [docs, setDocs] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshDocs = useCallback(async () => {
    if (!profile) return;
    try {
      setDocs(await fetchDocuments(profile.id));
    } catch (e) {
      console.error("fetchDocuments failed:", e);
    }
  }, [profile]);

  const refreshSharedDocs = useCallback(async () => {
    if (!profile) return;
    try {
      const shared = await fetchSharedDocuments(profile.id);
      // Extract the document from each share record
      setSharedDocs(shared.map(s => ({ ...s.document, shared_by: s.shared_by_profile, share_created_at: s.created_at })));
    } catch (e) {
      console.error("fetchSharedDocuments failed:", e);
    }
  }, [profile]);

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
        const [d, n, p, sd] = await Promise.all([
          fetchDocuments(profile.id),
          fetchNotifications(profile.id),
          fetchProfiles(),
          fetchSharedDocuments(profile.id),
        ]);
        if (!mounted) return;
        setDocs(d);
        setNotifications(n);
        setProfiles(p);
        setSharedDocs(sd.map(s => ({ ...s.document, shared_by: s.shared_by_profile, share_created_at: s.created_at })));
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
      .on("postgres_changes", { event: "*", schema: "public", table: "document_shares" }, refreshSharedDocs)
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
  }, [profile, refreshDocs, refreshSharedDocs, refreshNotifications]);

  return {
    docs,
    sharedDocs,
    notifications,
    profiles,
    loading,
    refreshDocs,
    refreshSharedDocs,
    refreshNotifications,
    setNotifications,
  };
}
