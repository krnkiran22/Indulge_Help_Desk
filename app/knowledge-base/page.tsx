'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { knowledgeBaseAPI, KB_CATEGORIES, type KBEntry } from '@/lib/api';

// ── Category config (dark-theme aware) ─────────────────────────────────────
const CATEGORY_META: Record<string, { color: string; bg: string; dot: string }> = {
  'About Indulge':   { color: 'text-amber-400',   bg: 'bg-amber-500/10',   dot: 'bg-amber-400' },
  'Services':        { color: 'text-blue-400',    bg: 'bg-blue-500/10',    dot: 'bg-blue-400' },
  'Pricing':         { color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  'Policies':        { color: 'text-violet-400',  bg: 'bg-violet-500/10',  dot: 'bg-violet-400' },
  'Destinations':    { color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    dot: 'bg-cyan-400' },
  'Dining':          { color: 'text-orange-400',  bg: 'bg-orange-500/10',  dot: 'bg-orange-400' },
  'Travel':          { color: 'text-teal-400',    bg: 'bg-teal-500/10',    dot: 'bg-teal-400' },
  'Events':          { color: 'text-pink-400',    bg: 'bg-pink-500/10',    dot: 'bg-pink-400' },
  'Behaviour Rules': { color: 'text-red-400',     bg: 'bg-red-500/10',     dot: 'bg-red-400' },
  'Other':           { color: 'text-zinc-400',    bg: 'bg-zinc-700/50',    dot: 'bg-zinc-500' },
};

const EMPTY_FORM = {
  title: '',
  content: '',
  category: 'About Indulge' as string,
  isActive: true,
  priority: 5,
};

// ── Helpers ────────────────────────────────────────────────────────────────
const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const wordCount = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

// ── Main component ─────────────────────────────────────────────────────────
export default function KnowledgeBasePage() {
  const router = useRouter();

  const [entries, setEntries]       = useState<KBEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [statusFilter, setStatus]   = useState<'all'|'active'|'inactive'>('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<KBEntry | null>(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');

  const [preview, setPreview]       = useState<KBEntry | null>(null);
  const [delTarget, setDelTarget]   = useState<KBEntry | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: 'success'|'error' } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) router.push('/login');
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'n' || e.key === 'N') && !drawerOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        openCreate();
      }
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setPreview(null);
        setDelTarget(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p: Record<string, string | boolean | number> = { limit: 200 };
      if (search)                        p.search   = search;
      if (catFilter)                     p.category = catFilter;
      if (statusFilter === 'active')     p.isActive = true;
      if (statusFilter === 'inactive')   p.isActive = false;
      const data = await knowledgeBaseAPI.getAll(p as any);
      setEntries(data.entries);
      setTotal(data.pagination.total);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
  }, [search, catFilter, statusFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const activeCount   = entries.filter(e => e.isActive).length;
  const inactiveCount = entries.length - activeCount;
  const categoryCount = [...new Set(entries.map(e => e.category))].length;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormErr('');
    setDrawerOpen(true);
    setPreview(null);
  };

  const openEdit = (entry: KBEntry) => {
    setEditing(entry);
    setForm({ title: entry.title, content: entry.content, category: entry.category, isActive: entry.isActive, priority: entry.priority });
    setFormErr('');
    setDrawerOpen(true);
    setPreview(null);
  };

  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); setFormErr(''); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    if (!form.title.trim() || !form.content.trim()) { setFormErr('Title and content are required.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await knowledgeBaseAPI.update(editing._id, form);
        setToast({ msg: 'Entry updated successfully.', type: 'success' });
      } else {
        await knowledgeBaseAPI.create(form);
        setToast({ msg: 'Entry created and live in the AI.', type: 'success' });
      }
      closeDrawer();
      fetchEntries();
    } catch (err: any) {
      setFormErr(err?.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (entry: KBEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await knowledgeBaseAPI.toggleActive(entry._id);
      setToast({ msg: `"${entry.title}" ${entry.isActive ? 'deactivated' : 'activated'}.`, type: 'success' });
      fetchEntries();
    } catch {
      setToast({ msg: 'Failed to update status.', type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await knowledgeBaseAPI.remove(delTarget._id);
      setToast({ msg: 'Entry deleted.', type: 'success' });
      setDelTarget(null);
      if (preview?._id === delTarget._id) setPreview(null);
      fetchEntries();
    } catch {
      setToast({ msg: 'Failed to delete.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-black text-white">

      {/* ── Header (matches dashboard exactly) ───────────────────────────── */}
      <header className="bg-zinc-950 border-b border-zinc-800 px-4 md:px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-yellow-500">AI Knowledge Base</h1>
            <p className="text-xs md:text-sm text-zinc-400">Indulge Help Desk · Admin</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex flex-1 max-w-[150px] sm:max-w-md mx-2 sm:mx-4 relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-yellow-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full pl-9 pr-8 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 focus:bg-zinc-900 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">New Entry</span>
        </button>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ─────────────────────────────────────────────── */}
        <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0 overflow-y-auto">

          {/* Stats */}
          <div className="p-4 border-b border-zinc-800 space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Overview</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Total',      value: total,         color: 'text-white' },
                { label: 'Active',     value: activeCount,   color: 'text-yellow-500' },
                { label: 'Inactive',   value: inactiveCount, color: 'text-zinc-500' },
                { label: 'Categories', value: categoryCount, color: 'text-yellow-500' },
              ].map(s => (
                <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div className="p-4 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Status</p>
            <div className="space-y-0.5">
              {(['all', 'active', 'inactive'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors font-medium ${
                    statusFilter === s
                      ? 'bg-yellow-500 text-black'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <span className="capitalize">{s === 'all' ? 'All entries' : s}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    statusFilter === s ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {s === 'all' ? total : s === 'active' ? activeCount : inactiveCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="p-4 flex-1">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Categories</p>
            <div className="space-y-0.5">
              <button
                onClick={() => setCatFilter('')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors font-medium ${
                  !catFilter ? 'bg-yellow-500 text-black' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                All categories
              </button>
              {KB_CATEGORIES.map(cat => {
                const meta = CATEGORY_META[cat] ?? CATEGORY_META['Other'];
                const count = entries.filter(e => e.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setCatFilter(cat === catFilter ? '' : cat)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                      catFilter === cat ? 'bg-yellow-500 text-black font-medium' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    <span className="flex-1 truncate">{cat}</span>
                    {count > 0 && (
                      <span className={`text-xs ${catFilter === cat ? 'text-black/60' : 'text-zinc-600'}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 flex overflow-hidden">

          {/* Entry list */}
          <div className={`flex flex-col overflow-hidden transition-all duration-200 ${preview ? 'w-[420px] shrink-0' : 'flex-1'}`}>

            {/* Toolbar */}
            <div className="px-6 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                {loading ? 'Loading…' : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
                {catFilter && <span className="ml-1 text-yellow-500 font-medium"> in {catFilter}</span>}
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <kbd className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono border border-zinc-700">N</kbd>
                <span>new</span>
                <span className="mx-1">·</span>
                <kbd className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono border border-zinc-700">Esc</kbd>
                <span>close</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mt-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-zinc-900">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-600">
                  <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading knowledge base…</span>
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center text-3xl">🧠</div>
                  <div className="text-center">
                    <p className="font-semibold text-white mb-1">No entries found</p>
                    <p className="text-sm text-zinc-500 mb-5">Add knowledge for the AI to use in every response</p>
                    <button onClick={openCreate} className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                      Add first entry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {entries.map(entry => {
                    const meta = CATEGORY_META[entry.category] ?? CATEGORY_META['Other'];
                    const isSelected = preview?._id === entry._id;
                    return (
                      <div
                        key={entry._id}
                        onClick={() => setPreview(isSelected ? null : entry)}
                        className={`flex items-start gap-4 px-6 py-4 cursor-pointer transition-colors group ${
                          isSelected
                            ? 'bg-zinc-800 border-l-2 border-yellow-500'
                            : 'bg-zinc-900 hover:bg-zinc-800/70 border-l-2 border-transparent'
                        }`}
                      >
                        {/* Active dot */}
                        <div className="mt-1 shrink-0">
                          <span className={`block w-2.5 h-2.5 rounded-full ${entry.isActive ? 'bg-yellow-500' : 'bg-zinc-600'}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border border-transparent ${meta.bg} ${meta.color}`}>
                              {entry.category}
                            </span>
                            {entry.priority >= 8 && (
                              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                                ★ High
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white truncate">{entry.title}</p>
                          <p className="text-xs text-zinc-500 truncate mt-0.5 leading-relaxed">
                            {entry.content.substring(0, 120)}{entry.content.length > 120 ? '…' : ''}
                          </p>
                          <p className="text-xs text-zinc-700 mt-1.5">{timeAgo(entry.updatedAt)}</p>
                        </div>

                        {/* Row actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={e => handleToggle(entry, e)}
                            title={entry.isActive ? 'Deactivate' : 'Activate'}
                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                              entry.isActive
                                ? 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'
                                : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-500/10'
                            }`}
                          >
                            {entry.isActive ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            )}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(entry); }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDelTarget(entry); }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Detail / Preview panel ──────────────────────────────────── */}
          {preview && (
            <div className="flex-1 bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-hidden">
              {/* Panel header */}
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const meta = CATEGORY_META[preview.category] ?? CATEGORY_META['Other'];
                    return (
                      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>
                        {preview.category}
                      </span>
                    );
                  })()}
                  <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                    preview.isActive ? 'bg-yellow-500/10 text-yellow-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${preview.isActive ? 'bg-yellow-500' : 'bg-zinc-600'}`} />
                    {preview.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(preview)}
                    className="flex items-center gap-1.5 text-sm text-yellow-400 hover:text-yellow-300 font-medium px-3 py-1.5 rounded-lg hover:bg-yellow-500/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit
                  </button>
                  <button onClick={() => setPreview(null)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <h2 className="text-xl font-bold text-white mb-4 leading-tight">{preview.title}</h2>

                {/* Meta row */}
                <div className="flex flex-wrap gap-4 mb-6 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Updated {new Date(preview.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    Priority {preview.priority}/10
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                    {wordCount(preview.content)} words
                  </span>
                </div>

                {/* Content */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">AI-injected content</p>
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{preview.content}</p>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={(e) => handleToggle(preview, e)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                      preview.isActive
                        ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                    }`}
                  >
                    {preview.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => setDelTarget(preview)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Delete entry
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Slide-in Drawer (create/edit) ─────────────────────────────────── */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="fixed top-0 right-0 h-full w-full max-w-[560px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {editing ? 'Edit knowledge entry' : 'New knowledge entry'}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">This will be injected into every AI conversation</p>
              </div>
              <button onClick={closeDrawer} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Drawer form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col">
              <div className="flex-1 px-6 py-6 space-y-5">

                {formErr && (
                  <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {formErr}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Indulge Membership Tiers"
                    maxLength={200}
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                  />
                </div>

                {/* Category + Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Category <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      required
                      className="w-full px-3.5 py-2.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                    >
                      {KB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Priority <span className="text-zinc-600 font-normal text-xs ml-1">(1–10)</span>
                    </label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: Math.min(10, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      min={0} max={10}
                      className="w-full px-3.5 py-2.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                    />
                    <p className="text-xs text-zinc-600 mt-1">Higher = injected first</p>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-zinc-300">
                      Content <span className="text-red-400">*</span>
                    </label>
                    <span className="text-xs text-zinc-600">{wordCount(form.content)} words · {form.content.length}/10,000</span>
                  </div>
                  <textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder={`Write the knowledge the AI should have.\n\nExample:\n• Indulge offers three membership tiers: Basic, Premium, and Elite.\n• Elite members get access to private events and dedicated concierge support 24/7.`}
                    maxLength={10000}
                    required
                    rows={14}
                    className="w-full px-3.5 py-3 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 focus:border-yellow-500/50 resize-y leading-relaxed font-mono transition-all"
                  />
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-zinc-300">Active</p>
                    <p className="text-xs text-zinc-600 mt-0.5">Inactive entries are saved but not sent to the AI</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {/* Drawer footer */}
              <div className="px-6 py-4 border-t border-zinc-800 flex items-center gap-3 bg-zinc-900/50">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-white border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold text-black bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : editing ? 'Update entry' : 'Create entry'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Delete confirm modal ──────────────────────────────────────────── */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Delete entry</h3>
                <p className="text-sm text-zinc-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm font-medium text-white">"{delTarget.title}"</p>
              <p className="text-xs text-zinc-500 mt-0.5">{delTarget.category}</p>
            </div>

            <p className="text-sm text-zinc-500 mb-5">
              Removing this entry will immediately stop the AI from using this knowledge in future conversations.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDelTarget(null)}
                className="flex-1 py-2.5 text-sm font-medium border border-zinc-700 text-zinc-400 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-60 rounded-lg transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border ${
          toast.type === 'success'
            ? 'bg-zinc-900 border-yellow-500/30 text-white'
            : 'bg-zinc-900 border-red-500/30 text-white'
        }`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs shrink-0 ${
            toast.type === 'success' ? 'bg-yellow-500 text-black' : 'bg-red-500'
          }`}>
            {toast.type === 'success' ? '✓' : '✕'}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
