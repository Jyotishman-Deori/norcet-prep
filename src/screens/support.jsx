// =====================================================================
// src/screens/support.jsx — the Support Center (owner reference: Spotify's
// support page). A single front door for "I need help", replacing a scatter of
// entry points the user had to already know about.
//
// CONTENT IS NOT NEW. It is a presentation layer over src/data/assistant-kb.js,
// which already ships KB_CATEGORIES (9), 80+ {id, cat, q, a} entries and
// QUICK_STARTS. So this screen stays in lockstep with the Ask-companion chat:
// add a KB entry and it appears in BOTH.
//
// ⚠ NO AI. Spotify's page leads with "Search with AI"; we deliberately do not
// copy that. The search box here is a local, rule-based filter over the KB
// (title + keywords + body), and "Ask your companion" opens the existing
// rule-based chat. There is no model call anywhere in this file. (CLAUDE.md:
// hard constraint, the student bundle stays 100% AI-free.)
//
// Layout: single column, md:max-w-3xl (the desktop single-column standard), so
// it reads identically on phone, tablet and desktop.
// =====================================================================
import React, { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Search, X, MessageCircle, Flag, Inbox,
  Users, Heart, LifeBuoy, Sparkles,
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar, requestFeedback, requestSupport } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import { prefersReducedMotion } from '../lib/juice.js';
import { KB_CATEGORIES, QUICK_STARTS, ASSISTANT_KB } from '../data/assistant-kb.js';
import { getConfig } from '../lib/game-config.js';

// Local, rule-based match over the bundled KB. Scores title hits above keyword
// hits above body hits, so "streak" surfaces the streak article first.
function searchArticles(query) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const e of ASSISTANT_KB) {
    const title = String(e.q || '').toLowerCase();
    const keys = (e.keywords || []).join(' ').toLowerCase();
    const body = String(e.a || '').toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 6;
      else if (keys.includes(term)) score += 3;
      else if (body.includes(term)) score += 1;
    }
    if (score > 0) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map((s) => s.e);
}

// One expandable Q&A row, rendered INSIDE a category's inset panel. It is
// deliberately lighter than a category header (medium weight, smaller type, a
// smaller chevron) so the two levels never read as the same control, which is
// what made the old flat accordion confusing. The answer is plain text with \n
// breaks (KB house style: no markdown), so it renders with pre-wrap exactly
// like explanations do.
function ArticleRow({ T, entry, open, onToggle, reduced, onNavigate, isFirst }) {
  return (
    <div style={isFirst ? undefined : { borderTop: `1px solid ${T.borderSoft}` }}>
      <button onClick={onToggle}
              aria-expanded={open}
              className={'sup-row no-tap-highlight w-full flex items-start justify-between gap-3 text-left px-3 py-3 rounded-lg'}
              style={{ background: 'transparent' }}>
        <span className="text-[13px] leading-snug"
              style={{ color: open ? T.primary : T.inkSoft, fontWeight: open ? 600 : 500 }}>
          {entry.q}
        </span>
        <ChevronDown size={14} aria-hidden="true"
                     className={'sup-chev flex-shrink-0 mt-0.5' + (open ? ' sup-chev-open' : '')}
                     style={{ color: open ? T.primary : T.muted }} />
      </button>
      {open && (
        <div className={'px-3 pb-3.5 -mt-0.5' + (reduced ? '' : ' sup-panel')}>
          <div className="text-[12.5px] leading-relaxed" style={{ color: T.inkSoft, whiteSpace: 'pre-wrap' }}>
            {entry.a}
          </div>
          {entry.route && entry.routeLabel && onNavigate && (
            <button onClick={() => onNavigate(entry.route)}
                    className="no-tap-highlight pressable inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl text-[12.5px] font-semibold"
                    style={{ background: T.primary + '14', color: T.primary, border: `1px solid ${T.primary}30` }}>
              {entry.routeLabel}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ T, children, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      {Icon && <Icon size={17} aria-hidden="true" style={{ color: T.muted }} />}
      <h2 className="font-display text-[1.05rem] font-semibold" style={{ color: T.ink }}>{children}</h2>
    </div>
  );
}

export default function SupportScreen({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const reduced = prefersReducedMotion();
  // The companion chat is parked (game_config.assistantChat, default OFF). The
  // card stays visible on purpose, wearing a Coming soon badge, so students know
  // it is planned rather than quietly missing. It opens the Coming soon screen.
  const companionOn = getConfig().assistantChat === true;

  const [query, setQuery] = useState('');
  const [openCat, setOpenCat] = useState(null);      // expanded category id
  const [openArticle, setOpenArticle] = useState(null); // expanded article id

  const results = useMemo(() => searchArticles(query), [query]);
  const searching = String(query).trim().length >= 2;

  // Category id -> its entries, in KB order.
  const byCat = useMemo(() => {
    const m = {};
    for (const e of ASSISTANT_KB) {
      if (!m[e.cat]) m[e.cat] = [];
      m[e.cat].push(e);
    }
    return m;
  }, []);

  const quick = useMemo(
    () => QUICK_STARTS.map((id) => ASSISTANT_KB.find((e) => e.id === id)).filter(Boolean),
    [],
  );

  const stag = (i) => (reduced ? {} : { className: 'sup-in', style: { animationDelay: `${Math.min(i, 6) * 70}ms` } });
  const toggleArticle = (id) => setOpenArticle((cur) => (cur === id ? null : id));

  const CONTACT = [
    {
      Icon: Flag, tone: T.accent,
      title: 'Report a problem',
      body: 'A wrong question, a bug, or something that looks off. It reaches the owner directly.',
      go: () => requestFeedback({ screen: 'Support Center' }),
    },
    {
      Icon: Inbox, tone: (T.sec && T.sec.stats) || T.primary,
      title: 'My reports',
      body: 'Track what you have reported and read the replies.',
      go: () => onNavigate && onNavigate({ screen: 'my-reports' }),
    },
    {
      Icon: Users, tone: T.success,
      title: 'Community questions',
      body: 'Browse what other aspirants asked, or ask your own.',
      go: () => onNavigate && onNavigate({ screen: 'faq' }),
    },
  ];

  return (
    <div className="anim-fadeup">
      <TopBar title="Support" onBack={onBack} feedback={{ screen: 'Support Center' }} />
      <PageContainer className="md:max-w-3xl">

        {/* ── Hero + search ─────────────────────────────────────────── */}
        <div {...stag(0)}>
          <div className="text-center pt-2 pb-1">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3.5"
                 style={{ background: `linear-gradient(135deg, ${T.primary}22, ${T.primary}0C)`,
                          border: `1.5px solid ${T.primary}30` }}>
              <LifeBuoy size={26} style={{ color: T.primary }} aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold mb-1.5" style={{ color: T.ink }}>
              How can we help?
            </h1>
            <p className="text-sm leading-relaxed mx-auto" style={{ color: T.inkSoft, maxWidth: 460 }}>
              Search the help articles, or browse by topic. Everything here works offline.
            </p>
          </div>

          <div className="relative mt-5 mb-2">
            <Search size={17} aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: T.muted }} />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="Search help: streak, premium, reset, offline..."
                   aria-label="Search help articles"
                   className="w-full rounded-2xl pl-11 pr-11 text-sm font-medium"
                   style={{ background: T.surface, border: `1.5px solid ${T.border}`,
                            color: T.ink, outline: 'none', minHeight: 52 }}
                   onFocus={(e) => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primary}1A`; }}
                   onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }} />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search"
                      className="no-tap-highlight absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg">
                <X size={15} style={{ color: T.muted }} />
              </button>
            )}
          </div>
        </div>

        {/* ── Search results (replace the browse sections while searching) ── */}
        {searching ? (
          <div className="mt-4">
            <SectionTitle T={T}>
              {results.length > 0
                ? `${results.length} ${results.length === 1 ? 'article' : 'articles'}`
                : 'No matching article'}
            </SectionTitle>
            {results.length > 0 ? (
              <Card className="p-1.5">
                {results.map((e, i) => (
                  <ArticleRow key={e.id} T={T} entry={e} reduced={reduced}
                              isFirst={i === 0}
                              open={openArticle === e.id}
                              onToggle={() => toggleArticle(e.id)}
                              onNavigate={onNavigate} />
                ))}
              </Card>
            ) : (
              <Card className="p-5 text-center">
                <div className="text-sm leading-relaxed mb-4" style={{ color: T.inkSoft }}>
                  {companionOn
                    ? 'Nothing matched that. Try a different word, ask your companion, or report it and a human will read it.'
                    : 'Nothing matched that. Try a different word, ask the community, or report it and a human will read it.'}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  {/* Parked companion: send them to humans, not to a Coming soon page.
                      Someone whose search just failed needs an answer now. */}
                  <button onClick={() => onNavigate && onNavigate({ screen: companionOn ? 'assistant' : 'faq' })}
                          className="no-tap-highlight pressable inline-flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-semibold"
                          style={{ background: T.primary, color: '#FFF', minHeight: 44 }}>
                    <MessageCircle size={15} aria-hidden="true" /> {companionOn ? 'Ask your companion' : 'Ask the community'}
                  </button>
                  <button onClick={() => requestFeedback({ screen: 'Support Center' })}
                          className="no-tap-highlight pressable inline-flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-semibold"
                          style={{ background: T.surface, color: T.ink, border: `1px solid ${T.border}`, minHeight: 44 }}>
                    <Flag size={15} aria-hidden="true" /> Report a problem
                  </button>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <>
            {/* ── Ask the companion (rule based, never an AI call) ─────── */}
            <div {...stag(1)} className={(reduced ? '' : 'sup-in ') + 'mt-2 mb-6'}>
              <Card className="sup-card p-4 cursor-pointer no-tap-highlight"
                    onClick={() => onNavigate && onNavigate({ screen: 'assistant' })}
                    style={{ background: `linear-gradient(135deg, ${T.primary}16, ${T.primary}08)`,
                             border: `1px solid ${T.primary}38` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: T.primary + '1F' }}>
                    <Sparkles size={19} style={{ color: T.primary }} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: T.ink }}>Ask your companion</span>
                      {!companionOn && (
                        <span className="text-[9.5px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: T.accent + '18', color: T.accent, border: `1px solid ${T.accent}45` }}>
                          Coming soon
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5 leading-relaxed" style={{ color: T.inkSoft }}>
                      {companionOn
                        ? 'Chat your question in your own words. Instant, offline answers.'
                        : 'A companion you can ask in your own words. We are still building it.'}
                    </div>
                  </div>
                  <ChevronRight size={18} className="flex-shrink-0" style={{ color: T.muted }} aria-hidden="true" />
                </div>
              </Card>
            </div>

            {/* ── Quick help ───────────────────────────────────────────── */}
            <div {...stag(2)} className={(reduced ? '' : 'sup-in ') + 'mb-6'}>
              <SectionTitle T={T}>Quick help</SectionTitle>
              <Card className="p-1.5">
                {quick.map((e, i) => (
                  <ArticleRow key={e.id} T={T} entry={e} reduced={reduced}
                              isFirst={i === 0}
                              open={openArticle === e.id}
                              onToggle={() => toggleArticle(e.id)}
                              onNavigate={onNavigate} />
                ))}
              </Card>
            </div>

            {/* ── Browse help articles (accordion by category) ─────────── */}
            <div {...stag(3)} className={(reduced ? '' : 'sup-in ') + 'mb-6'}>
              <SectionTitle T={T}>Browse help articles</SectionTitle>
              {/* Two clearly different levels. A CATEGORY is a bold section
                  header with a counted pill; its articles open into a RECESSED,
                  left-ruled inset panel so they read as contained inside it.
                  Previously both levels were the same row with the same chevron
                  and only a 2px indent, which is why it looked like an
                  undifferentiated wall. */}
              <Card className="p-1.5">
                {Object.entries(KB_CATEGORIES).map(([catId, catLabel], ci) => {
                  const entries = byCat[catId] || [];
                  if (entries.length === 0) return null;
                  const open = openCat === catId;
                  return (
                    <div key={catId} style={ci === 0 ? undefined : { borderTop: `1px solid ${T.borderSoft}` }}>
                      <button onClick={() => { setOpenCat(open ? null : catId); setOpenArticle(null); }}
                              aria-expanded={open}
                              className="sup-row no-tap-highlight w-full flex items-center justify-between gap-3 text-left px-3 py-4 rounded-xl"
                              style={{ background: open ? T.primary + '12' : 'transparent' }}>
                        <span className="font-display text-[15px] font-semibold"
                              style={{ color: open ? T.primary : T.ink }}>
                          {catLabel}
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10.5px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
                                style={open
                                  ? { background: T.primary + '20', color: T.primary }
                                  : { background: T.surfaceWarm, color: T.muted }}>
                            {entries.length}
                          </span>
                          <ChevronDown size={18} aria-hidden="true"
                                       className={'sup-chev' + (open ? ' sup-chev-open' : '')}
                                       style={{ color: open ? T.primary : T.muted }} />
                        </span>
                      </button>
                      {open && (
                        <div className={'ml-3 mr-1 mt-0.5 mb-2 rounded-xl overflow-hidden' + (reduced ? '' : ' sup-panel')}
                             style={{ background: T.bg, borderLeft: `2px solid ${T.primary}55` }}>
                          {entries.map((e, i) => (
                            <ArticleRow key={e.id} T={T} entry={e} reduced={reduced}
                                        isFirst={i === 0}
                                        open={openArticle === e.id}
                                        onToggle={() => toggleArticle(e.id)}
                                        onNavigate={onNavigate} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            </div>
          </>
        )}

        {/* ── Still need help? (always visible, even mid-search) ─────── */}
        <div {...stag(4)} className={(reduced ? '' : 'sup-in ') + 'mb-6'}>
          <SectionTitle T={T}>Still need help?</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CONTACT.map((c) => (
              <Card key={c.title} className="sup-card p-4 cursor-pointer no-tap-highlight" onClick={c.go}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5"
                     style={{ background: c.tone + '18' }}>
                  <c.Icon size={17} style={{ color: c.tone }} aria-hidden="true" />
                </div>
                <div className="text-[13.5px] font-semibold mb-1" style={{ color: T.ink }}>{c.title}</div>
                <div className="text-[12px] leading-relaxed" style={{ color: T.muted }}>{c.body}</div>
              </Card>
            ))}
          </div>
        </div>

        {/* ── Support the app (the original "buy me a chai" flow) ────── */}
        <div {...stag(5)} className={(reduced ? '' : 'sup-in ') + 'mb-8'}>
          <Card className="sup-card p-4 cursor-pointer no-tap-highlight" onClick={() => requestSupport()}
                style={{ background: `linear-gradient(135deg, ${T.accent}14, ${T.accent}08)`,
                         border: `1px solid ${T.accent}38` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: T.accent + '1F' }}>
                <Heart size={19} style={{ color: T.accent }} fill={T.accent} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold" style={{ color: T.ink }}>Support the app</div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: T.inkSoft }}>
                  NurseHolic is free and ad-free. If it helped your prep, you can buy the developer a chai.
                </div>
              </div>
              <ChevronRight size={18} className="flex-shrink-0" style={{ color: T.muted }} aria-hidden="true" />
            </div>
          </Card>
        </div>

      </PageContainer>
    </div>
  );
}
