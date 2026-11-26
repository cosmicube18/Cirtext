import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  ChevronDown,
  Cloud,
  CloudOff,
  FolderOpen,
  Loader2,
  LogOut,
  Save,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';
import { esp32RuntimeManager } from '../../simulation/esp32/Esp32RuntimeManager.ts';

interface NodePositions {
  [nodeId: string]: { x: number; y: number };
}

interface CircuitDraft {
  id: string;
  user_id: string;
  title: string;
  dsl_text: string;
  esp32_code: string | null;
  node_positions: NodePositions | null;
  updated_at: string;
}

function readCurrentCircuit() {
  const state = useCircuitStore.getState();
  const nodePositions: NodePositions = {};
  for (const node of state.nodes) {
    nodePositions[node.id] = { x: node.position.x, y: node.position.y };
  }
  return {
    dslText: state.dslText,
    esp32Code: esp32RuntimeManager.getCurrentCode(),
    nodePositions,
  };
}

const PENDING_DRAFT_KEY = 'cirtext_pending_draft';

interface PendingDraft {
  dslText: string;
  esp32Code: string;
  nodePositions: NodePositions;
  autoSave: boolean;
}

function stashGuestWorkspace(autoSave: boolean): void {
  try {
    const { dslText, esp32Code, nodePositions } = readCurrentCircuit();
    const pending: PendingDraft = {
      dslText,
      esp32Code,
      nodePositions,
      autoSave,
    };
    sessionStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(pending));
  } catch (err) {
    console.error('Failed to stash guest workspace:', err);
  }
}

export const CloudDraftsMenu: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [drafts, setDrafts] = useState<CircuitDraft[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftTitle, setActiveDraftTitle] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashStatus = useCallback((message: string) => {
    setStatusMessage(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusMessage(null), 3500);
  }, []);

  const restorePendingDraft = useCallback(
    async (session: Session) => {
      if (!supabase) return;

      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(PENDING_DRAFT_KEY);
        if (raw === null) return;
        sessionStorage.removeItem(PENDING_DRAFT_KEY);
      } catch (err) {
        console.error('Failed to read pending draft:', err);
        return;
      }

      let pending: PendingDraft;
      try {
        pending = JSON.parse(raw) as PendingDraft;
      } catch (err) {
        console.error('Failed to parse pending draft:', err);
        return;
      }

      try {
        await useCircuitStore.getState().setDslText(pending.dslText ?? '');

        if (pending.nodePositions) {
          const positions = pending.nodePositions;
          const currentNodes = useCircuitStore.getState().nodes;
          const restored = currentNodes.map((node) =>
            positions[node.id]
              ? { ...node, position: { ...positions[node.id] } }
              : node
          );
          useCircuitStore.getState().updateNodes(restored);
        }

        esp32RuntimeManager.setCurrentCode(pending.esp32Code ?? '');

        if (pending.autoSave) {
          const input = window.prompt('Name this draft:', 'Untitled Circuit');
          const title =
            input === null ? 'Untitled Circuit' : input.trim() || 'Untitled Circuit';

          const { data, error } = await supabase
            .from('circuit_drafts')
            .insert({
              user_id: session.user.id,
              title,
              dsl_text: pending.dslText ?? '',
              esp32_code: pending.esp32Code ?? '',
              node_positions: pending.nodePositions ?? {},
            })
            .select()
            .single();
          if (error) throw error;
          setActiveDraftId(data.id);
          setActiveDraftTitle(data.title);
          flashStatus('Guest circuit saved');
        } else {
          flashStatus('Restored your unsaved circuit');
        }
      } catch (err) {
        console.error('Failed to restore pending draft:', err);
        flashStatus('Could not restore unsaved circuit');
      }
    },
    [flashStatus]
  );

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const session = data.session;
      setUser(session?.user ?? null);
      if (session) void restorePendingDraft(session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session) {
          void restorePendingDraft(session);
        } else {
          setDrafts([]);
          setDraftsOpen(false);
          setActiveDraftId(null);
          setActiveDraftTitle(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, [restorePendingDraft]);

  const beginSignIn = useCallback((autoSave: boolean) => {
    if (!supabase) return;
    stashGuestWorkspace(autoSave);
    void supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const handleSignIn = useCallback(() => beginSignIn(false), [beginSignIn]);
  const handleGuestSave = useCallback(() => beginSignIn(true), [beginSignIn]);

  const handleSignOut = useCallback(() => {
    if (!supabase) return;
    void supabase.auth.signOut();
  }, []);

  const handleSave = useCallback(
    async (saveAsNew: boolean) => {
      if (!supabase || !user) return;

      const { dslText, esp32Code, nodePositions } = readCurrentCircuit();

      let title = activeDraftTitle;
      if (saveAsNew || !activeDraftId) {
        const input = window.prompt('Name this draft:', title ?? 'Untitled Circuit');
        if (input === null) return;
        title = input.trim() || 'Untitled Circuit';
      }

      setIsSaving(true);
      try {
        if (activeDraftId && !saveAsNew) {
          const { error } = await supabase
            .from('circuit_drafts')
            .update({
              title,
              dsl_text: dslText,
              esp32_code: esp32Code,
              node_positions: nodePositions,
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeDraftId);
          if (error) throw error;
          setActiveDraftTitle(title);
          flashStatus('Draft saved');
        } else {
          const { data, error } = await supabase
            .from('circuit_drafts')
            .insert({
              user_id: user.id,
              title,
              dsl_text: dslText,
              esp32_code: esp32Code,
              node_positions: nodePositions,
            })
            .select()
            .single();
          if (error) throw error;
          setActiveDraftId(data.id);
          setActiveDraftTitle(data.title);
          flashStatus('New draft created');
        }
      } catch (err) {
        console.error('Failed to save draft:', err);
        flashStatus('Save failed');
      } finally {
        setIsSaving(false);
      }
    },
    [activeDraftId, activeDraftTitle, user, flashStatus]
  );

  const fetchDrafts = useCallback(async () => {
    if (!supabase || !user) return;
    setIsLoadingDrafts(true);
    try {
      const { data, error } = await supabase
        .from('circuit_drafts')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setDrafts((data as CircuitDraft[]) ?? []);
    } catch (err) {
      console.error('Failed to load drafts:', err);
      flashStatus('Could not load drafts');
    } finally {
      setIsLoadingDrafts(false);
    }
  }, [user, flashStatus]);

  const handleToggleDrafts = useCallback(() => {
    setDraftsOpen((prev) => {
      const next = !prev;
      if (next) void fetchDrafts();
      return next;
    });
  }, [fetchDrafts]);

  const handleLoad = useCallback(
    async (draft: CircuitDraft) => {
      const store = useCircuitStore.getState();
      await store.setDslText(draft.dsl_text);

      if (draft.node_positions) {
        const positions = draft.node_positions;
        const currentNodes = useCircuitStore.getState().nodes;
        const restored = currentNodes.map((node) =>
          positions[node.id]
            ? { ...node, position: { ...positions[node.id] } }
            : node
        );
        useCircuitStore.getState().updateNodes(restored);
      }

      esp32RuntimeManager.setCurrentCode(draft.esp32_code ?? '');

      setActiveDraftId(draft.id);
      setActiveDraftTitle(draft.title);
      setDraftsOpen(false);
      flashStatus(`Loaded "${draft.title}"`);
    },
    [flashStatus]
  );

  const handleDelete = useCallback(
    async (draft: CircuitDraft) => {
      if (!supabase) return;
      if (!window.confirm(`Delete draft "${draft.title}"?`)) return;
      try {
        const { error } = await supabase
          .from('circuit_drafts')
          .delete()
          .eq('id', draft.id);
        if (error) throw error;
        setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
        if (activeDraftId === draft.id) {
          setActiveDraftId(null);
          setActiveDraftTitle(null);
        }
      } catch (err) {
        console.error('Failed to delete draft:', err);
        flashStatus('Delete failed');
      }
    },
    [activeDraftId, flashStatus]
  );

  if (!supabase) {
    return (
      <span
        title="Cloud features are offline. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file to enable Google sign-in and cloud draft saving."
        className="flex shrink-0 items-center gap-1.5 px-2 md:px-2.5 py-1.5 rounded-md bg-slate-800/60 text-slate-500 border border-slate-700/60 text-xs font-medium cursor-not-allowed select-none"
      >
        <CloudOff className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Cloud Offline</span>
      </span>
    );
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    'Account';

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={handleGuestSave}
          title="Sign in to save your circuit to the cloud"
          className="flex shrink-0 items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-sm"
        >
          <Save className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Save</span>
        </button>

        <button
          onClick={handleSignIn}
          title="Sign in with Google to save drafts to the cloud"
          className="flex shrink-0 items-center gap-1.5 px-2 md:px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-medium transition-colors shadow-sm"
        >
          <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Sign in with Google</span>
          <span className="sm:hidden">Sign in</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex shrink-0 items-center gap-1.5">
      <div
        className="hidden lg:flex items-center gap-1.5 max-w-[160px]"
        title={displayName}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="w-6 h-6 rounded-full border border-slate-600 shrink-0"
          />
        ) : (
          <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-[11px] text-slate-300 truncate">
          {user.email}
        </span>
      </div>

      <button
        onClick={() => void handleSave(false)}
        disabled={isSaving}
        title={activeDraftTitle ? `Save "${activeDraftTitle}"` : 'Save current circuit'}
        className="flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
      >
        {isSaving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          <Save className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="hidden md:inline">Save</span>
      </button>

      <button
        onClick={() => void handleSave(true)}
        disabled={isSaving}
        title="Save as a new draft"
        className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
      >
        <Cloud className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden xl:inline">Save As New</span>
      </button>

      <div className="relative">
        <button
          onClick={handleToggleDrafts}
          title="Open cloud drafts"
          className="flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-medium transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="hidden sm:inline">Drafts</span>
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </button>

        {draftsOpen && (
          <div className="absolute top-full right-0 mt-1 w-72 max-w-[calc(100vw-24px)] rounded-md bg-slate-900 border border-slate-700 shadow-2xl py-1 z-50 flex flex-col">
            <div className="px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cloud Drafts
              </span>
              {isLoadingDrafts && (
                <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
              )}
            </div>

            {!isLoadingDrafts && drafts.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-slate-500">
                No saved drafts yet.
              </div>
            )}

            <div className="max-h-72 overflow-y-auto">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className={`px-3 py-2 border-b border-slate-800/60 last:border-b-0 flex items-center justify-between gap-2 ${
                    activeDraftId === draft.id ? 'bg-sky-950/40' : ''
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-slate-100 truncate">
                      {draft.title}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(draft.updated_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => void handleLoad(draft)}
                      title="Load draft"
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => void handleDelete(draft)}
                      title="Delete draft"
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleSignOut}
        title="Sign out"
        className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-800/50 text-xs font-medium transition-colors"
      >
        <LogOut className="w-3.5 h-3.5 shrink-0" />
      </button>

      {statusMessage && (
        <div className="absolute top-full right-0 mt-1 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 shadow-2xl text-[11px] text-slate-100 whitespace-nowrap z-50">
          {statusMessage}
        </div>
      )}
    </div>
  );
};

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);
