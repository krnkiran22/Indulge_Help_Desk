'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { knowledgeBaseAPI, KB_CATEGORIES, type KBEntry } from '@/lib/api';

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { color: string; bg: string; dot: string }> = {
  'About Indulge':  { color: 'text-amber-700',  bg: 'bg-amber-50',   dot: 'bg-amber-400' },
  'Services':       { color: 'text-blue-700',   bg: 'bg-blue-50',    dot: 'bg-blue-400' },
  'Pricing':        { color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-400' },
  'Policies':       { color: 'text-violet-700', bg: 'bg-violet-50',  dot: 'bg-violet-400' },
  'Destinations':   { color: 'text-cyan-700',   bg: 'bg-cyan-50',    dot: 'bg-cyan-400' },
  'Dining':         { color: 'text-orange-700', bg: 'bg-orange-50',  dot: 'bg-orange-400' },
  'Travel':         { color: 'text-teal-700',   bg: 'bg-teal-50',    dot: 'bg-teal-400' },
  'Events':         { color: 'text-pink-700',   bg: 'bg-pink-50',    dot: 'bg-pink-400' },
  'Behaviour Rules':{ color: 'text-red-700',    bg: 'bg-red-50',     dot: 'bg-red-400' },
  'Other':          { color: 'text-slate-600',  bg: 'bg-slate-100',  dot: 'bg-slate-400' },
};

const EMPTY_FORM = {
  title: '',
  content: '',
  category: 'About Indulge' as string,
  isActive: true,
  priority: 5,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function KnowledgeBasePage() {
  const router = useRouter();

  // List state
  const [entries, setEntries]       = useState<KBEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [statusFilter, setStatus]   = useState<'all'|'active'|'inactive'>('all');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<KBEntry | null>(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');

  // Detail preview
  const [preview, setPreview]       = useState<KBEntry | null>(null);

  // Delete confirm
  const [delTarget, setDelTarget]   = useState<KBEntry | null>(null);
  const [deleting, setDeleting]     = useState(false);

  // Flash
  const [toast, setToast]           = useState<{ msg: string; type: 'success'|'error' } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem('adminToken')) router.push('/login');
  }, [router]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Keyboard shortcut: N = new entry
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

  // Fetch
  const fetch = useCallback(async () => {
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

  useEffect(() => { fetch(); }, [fetch]);

  // Derived stats
  const activeCount   = entries.filter(e => e.isActive).length;
  const inactiveCount = entries.length - activeCount;
  const categoryCount = [...new Set(entries.map(e => e.category))].length;

  // Form helpers
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
      fetch();
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
      fetch();
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
      fetch();
    } catch {
      setToast({ msg: 'Failed to delete.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f6fa] flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Top nav ──────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-slate-200 px-6 py-0 flex items-center gap-0 h-14 sticky top-0 z-30 shadow-sm">
        {/* Logo / back */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 h-14 pr-6 border-r border-slate-200 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Dashboard
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 px-6">
          <span className="text-slate-400 text-sm">Indulge Admin</span>
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-800 font-semibold text-sm">AI Knowledge Base</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search knowledge base…"
              className="pl-9 pr-4 py-1.5 w-64 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder-slate-400 text-slate-700"
            />
          </div>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Entry
          </button>
        </div>
      </nav>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">

          {/* Stats cards */}
          <div className="p-4 border-b border-slate-100 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Overview</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Total', value: total, color: 'text-slate-700' },
                { label: 'Active', value: activeCount, color: 'text-emerald-600' },
                { label: 'Inactive', value: inactiveCount, color: 'text-slate-400' },
                { label: 'Categories', value: categoryCount, color: 'text-indigo-600' },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-lg p-3">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</p>
            <div className="space-y-0.5">
              {(['all', 'active', 'inactive'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                    statusFilter === s
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="capitalize">{s === 'all' ? 'All entries' : s}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    statusFilter === s ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {s === 'all' ? total : s === 'active' ? activeCount : inactiveCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="p-4 flex-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Categories</p>
            <div className="space-y-0.5">
              <button
                onClick={() => setCatFilter('')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                  !catFilter ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-300" />
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
                      catFilter === cat ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    <span className="flex-1 truncate">{cat}</span>
                    {count > 0 && (
                      <span className="text-xs text-slate-400">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex overflow-hidden">

          {/* Entry list */}
          <div className={`flex flex-col overflow-hidden transition-all duration-200 ${preview ? 'w-[420px] shrink-0' : 'flex-1'}`}>
            {/* Toolbar */}
            <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {loading ? 'Loading…' : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
                {catFilter && <span className="ml-1 text-indigo-600 font-medium">in {catFilter}</span>}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <kbd className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">N</kbd>
                <span>new entry</span>
                <span className="mx-1">·</span>
                <kbd className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">Esc</kbd>
                <span>close</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                  <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading knowledge base…</span>
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl">🧠</div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-700 mb-1">No entries found</p>
                    <p className="text-sm text-slate-400 mb-5">Add knowledge for the AI to use in every response</p>
                    <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                      Add first entry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {entries.map(entry => {
                    const meta = CATEGORY_META[entry.category] ?? CATEGORY_META['Other'];
                    const isSelected = preview?._id === entry._id;
                    return (
                      <div
                        key={entry._id}
                        onClick={() => setPreview(isSelected ? null : entry)}
                        className={`flex items-start gap-4 px-6 py-4 cursor-pointer transition-colors group ${
                          isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : 'bg-white hover:bg-slate-50 border-l-2 border-transparent'
                        }`}
                      >
                        {/* Active dot */}
                        <div className="mt-1 shrink-0">
                          <span className={`block w-2.5 h-2.5 rounded-full ${entry.isActive ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                              {entry.category}
                            </span>
                            {entry.priority >= 8 && (
                              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                ★ High priority
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-800 truncate">{entry.title}</p>
                          <p className="text-xs text-slate-400 truncate mt-0.5 leading-relaxed">
                            {entry.content.substring(0, 120)}{entry.content.length > 120 ? '…' : ''}
                          </p>
                          <p className="text-xs text-slate-300 mt-1.5">{timeAgo(entry.updatedAt)}</p>
                        </div>

                        {/* Row actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={e => handleToggle(entry, e)}
                            title={entry.isActive ? 'Deactivate' : 'Activate'}
                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                              entry.isActive
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDelTarget(entry); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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

          {/* ── Detail / Preview panel ──────────────────────────────────────── */}
          {preview && (
            <div className="flex-1 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
              {/* Panel header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
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
                    preview.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${preview.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                    {preview.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(preview)}
                    className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit
                  </button>
                  <button onClick={() => setPreview(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4 leading-tight">{preview.title}</h2>

                {/* Meta row */}
                <div className="flex flex-wrap gap-4 mb-6 text-xs text-slate-500">
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">AI-injected content</p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{preview.content}</p>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={(e) => handleToggle(preview, e)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                      preview.isActive
                        ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {preview.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => setDelTarget(preview)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete entry
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Slide-in Drawer (create/edit) ────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" onClick={closeDrawer} />

          {/* Drawer */}
          <div className="fixed top-0 right-0 h-full w-full max-w-[560px] bg-white shadow-2xl z-50 flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editing ? 'Edit knowledge entry' : 'New knowledge entry'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">This will be injected into every AI conversation</p>
              </div>
              <button onClick={closeDrawer} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Drawer form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col">
              <div className="flex-1 px-6 py-6 space-y-5">
                {formErr && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {formErr}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Indulge Membership Tiers"
                    maxLength={200}
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Category + Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      required
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                    >
                      {KB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Priority
                      <span className="text-slate-400 font-normal ml-1 text-xs">(1–10)</span>
                    </label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: Math.min(10, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      min={0} max={10}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-400 mt-1">Higher = injected first into AI</p>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Content <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs text-slate-400">{wordCount(form.content)} words · {form.content.length}/10,000</span>
                  </div>
                  <textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder={`Write the knowledge the AI should have.\n\nExample:\n• Indulge offers three membership tiers: Basic, Premium, and Elite.\n• Elite members get access to private events and dedicated concierge support 24/7.\n• Memberships are renewed annually and can be upgraded at any time.`}
                    maxLength={10000}
                    required
                    rows={14}
                    className="w-full px-3.5 py-3 text-sm border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed font-mono"
                  />
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Active</p>
                    <p className="text-xs text-slate-400 mt-0.5">Inactive entries are saved but not sent to the AI</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {/* Drawer footer */}
              <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-3 bg-slate-50">
                <button type="button" onClick={closeDrawer} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors shadow-sm"
                >
                  {saving ? 'Saving…' : editing ? 'Update entry' : 'Create entry'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Delete confirm modal ──────────────────────────────────────────────── */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete entry</h3>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm font-medium text-slate-800">"{delTarget.title}"</p>
              <p className="text-xs text-slate-500 mt-0.5">{delTarget.category}</p>
            </div>

            <p className="text-sm text-slate-600 mb-5">
              Removing this entry will immediately stop the AI from using this knowledge in future conversations.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)} className="flex-1 py-2.5 text-sm font-medium border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors">
                {deleting ? 'Deleting…' : 'Delete entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all border ${
          toast.type === 'success'
            ? 'bg-white border-emerald-200 text-emerald-800'
            : 'bg-white border-red-200 text-red-800'
        }`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`}>
            {toast.type === 'success' ? '✓' : '✕'}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
