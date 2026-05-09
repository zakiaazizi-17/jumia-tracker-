import { useEffect, useState, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line, Area, AreaChart,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts";

const API = "https://chaimaa.pythonanywhere.com";

const COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#a855f7",
  "#ef4444", "#eab308", "#06b6d4", "#ec4899",
  "#84cc16", "#f59e0b"
];

const ORANGE = "#f97316";

// ─── utils ───────────────────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return "";
  const d = new Date(typeof val === "number" ? val : Number(val));
  if (isNaN(d)) return String(val).slice(0, 10);
  return d.toLocaleDateString("fr-MA", { day: "2-digit", month: "short" });
}

function fmtMAD(v) {
  return Math.round(v).toLocaleString() + " MAD";
}

// ─── custom tooltips ──────────────────────────────────────────────────────────
function MultiTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tt}>
      <p style={{ color: "#94a3b8", margin: "0 0 6px", fontSize: 11 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0", fontWeight: 500, fontSize: 12 }}>
          {p.name.length > 32 ? p.name.slice(0, 30) + "…" : p.name}:{" "}
          <span style={{ color: "#0f172a" }}>{fmtMAD(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function AreaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={tt}>
      <p style={{ color: "#94a3b8", margin: "0 0 8px", fontSize: 11 }}>{label}</p>
      <p style={{ color: "#f97316", margin: "2px 0", fontSize: 12 }}>
        Moyenne: <span style={{ color: "#0f172a" }}>{fmtMAD(d?.avg)}</span>
      </p>
      <p style={{ color: "#10b981", margin: "2px 0", fontSize: 12 }}>
        Min: <span style={{ color: "#0f172a" }}>{fmtMAD(d?.min)}</span>
      </p>
      <p style={{ color: "#ef4444", margin: "2px 0", fontSize: 12 }}>
        Max: <span style={{ color: "#0f172a" }}>{fmtMAD(d?.max)}</span>
      </p>
      <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: 11 }}>
        {d?.count} produits
      </p>
    </div>
  );
}

const tt = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "10px 14px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
};

// ─── Autocomplete input ───────────────────────────────────────────────────────
function AutocompleteInput({ value, onChange, onSelect, onSearch, placeholder, searching }) {
  const [suggestions, setSuggestions]   = useState({ categories: [], products: [] });
  const [open, setOpen]                 = useState(false);
  const [hovered, setHovered]           = useState(null);
  const debounce                        = useRef(null);
  const wrapRef                         = useRef(null);

  // close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleChange(e) {
    const v = e.target.value;
    onChange(v);
    clearTimeout(debounce.current);
    if (v.length < 2) { setSuggestions({ categories: [], products: [] }); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/suggestions?q=${encodeURIComponent(v)}`);
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.categories.length > 0 || data.products.length > 0);
      } catch {}
    }, 200);
  }

  function pick(v) {
    onSelect(v);
    setOpen(false);
    setSuggestions({ categories: [], products: [] });
  }

  const hasSuggestions = suggestions.categories.length > 0 || suggestions.products.length > 0;

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1 }}>
      <input
        style={sx.input}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={e => { if (e.key === "Enter") { setOpen(false); onSearch(); } }}
        onFocus={() => hasSuggestions && setOpen(true)}
        autoComplete="off"
      />
      {open && hasSuggestions && (
        <div style={sx.dropdown}>
          {suggestions.categories.length > 0 && (
            <>
              <p style={sx.dropLabel}>Catégories</p>
              {suggestions.categories.map((c, i) => (
                <div
                  key={"cat-" + i}
                  style={{ ...sx.dropItem, background: hovered === "cat" + i ? "#f8f9fb" : "transparent" }}
                  onMouseEnter={() => setHovered("cat" + i)}
                  onMouseLeave={() => setHovered(null)}
                  onMouseDown={() => pick(c)}
                >
                  <span style={sx.badge("cat")}>catégorie</span>
                  {c}
                </div>
              ))}
            </>
          )}
          {suggestions.products.length > 0 && (
            <>
              <p style={sx.dropLabel}>Produits</p>
              {suggestions.products.map((p, i) => (
                <div
                  key={"prd-" + i}
                  style={{ ...sx.dropItem, background: hovered === "prd" + i ? "#f8f9fb" : "transparent" }}
                  onMouseEnter={() => setHovered("prd" + i)}
                  onMouseLeave={() => setHovered(null)}
                  onMouseDown={() => pick(p)}
                >
                  <span style={sx.badge("prd")}>produit</span>
                  {p.length > 55 ? p.slice(0, 53) + "…" : p}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [counts,        setCounts]        = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [selectedCat,   setSelectedCat]   = useState(null);
  const [catDetail,     setCatDetail]     = useState([]);
  const [catLoading,    setCatLoading]    = useState(false);
  const [query,         setQuery]         = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching,     setSearching]     = useState(false);
  const [searched,      setSearched]      = useState(false);
  const [scraperStatus, setScraperStatus] = useState(null);
  const catDetailRef                      = useRef(null);

  // initial load
  useEffect(() => {
    fetch(`${API}/category-count`)
      .then(r => r.json()).then(setCounts)
      .catch(console.error);

    fetch(`${API}/categories`)
      .then(r => r.json())
      .then(data => {
        const fixed = data.map(row => ({ ...row, date: formatDate(row.date) }));
        setCategories(fixed);
      })
      .catch(console.error);

    fetch(`${API}/scraper-status`)
      .then(r => r.json()).then(setScraperStatus)
      .catch(console.error);
  }, []);

  // click on a bar → load category detail
  const handleBarClick = useCallback(async (data) => {
    if (!data?.activePayload?.[0]) return;
    const cat = data.activePayload[0].payload.category;
    setSelectedCat(cat);
    setCatLoading(true);
    try {
      const res = await fetch(`${API}/category/${encodeURIComponent(cat)}`);
      const json = await res.json();
      setCatDetail(json);
    } catch (e) {
      console.error(e);
      setCatDetail([]);
    }
    setCatLoading(false);
    // scroll to detail chart
    setTimeout(() => catDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, []);

  // line keys for multi-line chart
  const lineKeys = categories.length > 0
    ? Object.keys(categories[0]).filter(k => k !== "date")
    : [];

  // search
  const handleSearch = useCallback(async () => {
  if (!query.trim()) return;

  setSearching(true);
  setSearched(true);

  try {
    // ───── 1. check if query is a category ─────
    const catMatch = counts.find(
      c => c.category.toLowerCase() === query.trim().toLowerCase()
    );

    if (catMatch) {
      setSelectedCat(catMatch.category);
      setSearchResults(null);

      const res = await fetch(
        `${API}/category/${encodeURIComponent(catMatch.category)}`
      );

      const json = await res.json();
      setCatDetail(json);

      setTimeout(() => {
        catDetailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 100);

      setSearching(false);
      return;
    }

    // ───── 2. otherwise search products normally ─────
    const res = await fetch(
      `${API}/product-search?q=${encodeURIComponent(query.trim())}`
    );

    const data = await res.json();

    const grouped = {};

    data.forEach(row => {
      if (!grouped[row.title]) grouped[row.title] = [];

      grouped[row.title].push({
        date: formatDate(row.date),
        price:
          parseFloat(String(row.price).replace(/[^\d.]/g, "")) || null,
        rawDate: row.date
      });
    });

    Object.keys(grouped).forEach(t =>
      grouped[t].sort(
        (a, b) => new Date(a.rawDate) - new Date(b.rawDate)
      )
    );

    const allDates = [...new Set(data.map(r => formatDate(r.date)))];

    allDates.sort((a, b) => new Date(a) - new Date(b));

    const titles = Object.keys(grouped).slice(0, 6);

    const chartData = allDates.map(date => {
      const row = { date };

      titles.forEach(t => {
        const entry = grouped[t].find(e => e.date === date);
        row[t] = entry ? entry.price : null;
      });

      return row;
    });

    setSearchResults({ titles, chartData, grouped });

  } catch (e) {
    console.error(e);
    setSearchResults(null);
  }

  setSearching(false);

}, [query, counts]);
  // trigger manual scrape
  async function triggerScrape() {
    try {
      const res  = await fetch(`${API}/scrape-now`, { method: "POST" });
      const data = await res.json();
      alert(data.status);
    } catch {
      alert("Erreur lors du démarrage du scraping.");
    }
  }

  // ── styles ──
  const S = {
    app: {
      minHeight: "100vh",
      background: "#f8f9fb",
      color: "#1e293b",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      padding: "40px 28px",
      maxWidth: 1200,
      margin: "0 auto"
    },
    header: { textAlign: "center", marginBottom: 48 },
    logo: {
      display: "inline-flex", alignItems: "center", gap: 12,
      marginBottom: 12
    },
    logoIcon: {
      width: 40, height: 40, borderRadius: 10,
      background: "linear-gradient(135deg,#f97316,#ef4444)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 20
    },
    h1: {
      fontSize: 32, fontWeight: 800, color: "#0f172a",
      margin: 0, letterSpacing: "-0.5px"
    },
    subtitle: { fontSize: 13, color: "#94a3b8", marginTop: 6 },
    statusBar: {
      display: "inline-flex", alignItems: "center", gap: 8,
      background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 20, padding: "5px 14px", fontSize: 12,
      color: "#64748b", marginTop: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
    },
    dot: { width: 7, height: 7, borderRadius: "50%", background: "#10b981", flexShrink: 0 },
    card: {
      background: "#ffffff",
      border: "1px solid #e8edf3",
      borderRadius: 16,
      padding: "28px 28px 24px",
      marginBottom: 24,
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
    },
    cardHeader: {
      display: "flex", alignItems: "center",
      justifyContent: "space-between", marginBottom: 20
    },
    sectionTitle: {
      fontSize: 11, fontWeight: 700, color: "#94a3b8",
      textTransform: "uppercase", letterSpacing: "0.12em", margin: 0
    },
    pill: (active) => ({
      background: active ? "#f97316" : "#f1f5f9",
      border: `1px solid ${active ? "#f97316" : "#e2e8f0"}`,
      borderRadius: 20, padding: "4px 12px",
      fontSize: 12, color: active ? "#fff" : "#64748b",
      cursor: "pointer", fontWeight: 500
    }),
    hint: {
      fontSize: 12, color: "#94a3b8",
      display: "flex", alignItems: "center", gap: 6
    },
    searchRow: { display: "flex", gap: 10, marginBottom: 20 },
    btnOrange: {
      background: "linear-gradient(135deg,#f97316,#ef4444)",
      border: "none", borderRadius: 10,
      color: "#fff", cursor: "pointer",
      fontSize: 13, fontWeight: 700,
      padding: "11px 24px", flexShrink: 0
    },
    tag: (i) => ({
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "#f8f9fb", border: `1px solid ${COLORS[i % COLORS.length]}44`,
      borderRadius: 20, fontSize: 12, padding: "4px 12px",
      marginRight: 8, marginBottom: 8, color: COLORS[i % COLORS.length]
    }),
    noResult: {
      textAlign: "center", color: "#94a3b8",
      fontSize: 13, padding: "32px 0"
    },
    scrapeBar: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "#fff", border: "1px solid #e8edf3",
      borderRadius: 12, padding: "14px 20px", marginBottom: 24,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
    },
    scrapeInfo: { fontSize: 12, color: "#64748b", lineHeight: 1.6 },
    btnGhost: {
      background: "transparent",
      border: "1px solid #e2e8f0",
      borderRadius: 8, color: "#64748b",
      cursor: "pointer", fontSize: 12,
      padding: "7px 14px", flexShrink: 0
    },
    catDetailHeader: {
      display: "flex", alignItems: "center",
      justifyContent: "space-between", marginBottom: 8
    },
    backBtn: {
      background: "transparent", border: "none",
      color: "#f97316", cursor: "pointer",
      fontSize: 12, padding: 0, display: "flex",
      alignItems: "center", gap: 4
    },
    statsRow: {
      display: "flex", gap: 12, marginBottom: 20
    },
    statBox: (color) => ({
      flex: 1, background: "#f8f9fb",
      border: `1px solid ${color}33`,
      borderRadius: 10, padding: "12px 16px"
    }),
    statLabel: { fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" },
    statValue: (color) => ({ fontSize: 18, fontWeight: 700, color, margin: 0 }),
  };

  // category detail stats
  const avgPrice = catDetail.length ? Math.round(catDetail.reduce((s, r) => s + r.avg, 0) / catDetail.length) : 0;
  const minPrice = catDetail.length ? Math.min(...catDetail.map(r => r.min)) : 0;
  const maxPrice = catDetail.length ? Math.max(...catDetail.map(r => r.max)) : 0;

  return (
    <div style={S.app}>

      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logo}>
          <div style={S.logoIcon}>📊</div>
          <h1 style={S.h1}>Jumia Price Tracker</h1>
        </div>
        <p style={S.subtitle}>Suivi des prix du marché marocain en temps réel</p>
        {scraperStatus && (
          <div style={S.statusBar}>
            <span style={S.dot} />
            Scraping automatique actif · Prochain : {
              scraperStatus.next_run
                ? new Date(scraperStatus.next_run).toLocaleString("fr-MA")
                : "—"
            }
          </div>
        )}
      </div>

      {/* SCRAPER CONTROL BAR */}
      <div style={S.scrapeBar}>
        <div>
          <p style={{ ...S.scrapeInfo, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>
            ⏰ Automatisation du scraping
          </p>
          <p style={S.scrapeInfo}>
            Le scraper tourne automatiquement chaque jour à minuit.
            Tu peux aussi le lancer manuellement.
          </p>
        </div>
        <button style={S.btnGhost} onClick={triggerScrape}>
          ▶ Lancer maintenant
        </button>
      </div>

      {/* BAR CHART — category distribution */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <p style={S.sectionTitle}>Distribution des catégories</p>
          <span style={S.hint}>
            <span style={{ fontSize: 14 }}>👆</span>
            Cliquez sur une barre pour voir l'évolution
          </span>
        </div>
        {counts.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={counts}
              barCategoryGap="35%"
              onClick={handleBarClick}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="category"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                labelStyle={{ color: "#64748b", fontSize: 12 }}
                itemStyle={{ color: "#0f172a", fontSize: 12 }}
                cursor={{ fill: "#f9731608" }}
              />
              <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                {counts.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={selectedCat === entry.category ? ORANGE : COLORS[i % COLORS.length]}
                    opacity={selectedCat && selectedCat !== entry.category ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={S.noResult}>Chargement…</p>
        )}
      </div>

      {/* CATEGORY DETAIL — shown after clicking a bar */}
      {selectedCat && (
        <div style={S.card} ref={catDetailRef}>
          <div style={S.catDetailHeader}>
            <div>
              <p style={S.sectionTitle}>Évolution des prix · catégorie</p>
              <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: ORANGE, textTransform: "capitalize" }}>
                {selectedCat}
              </p>
            </div>
            <button style={S.backBtn} onClick={() => { setSelectedCat(null); setCatDetail([]); }}>
              ✕ Fermer
            </button>
          </div>

          {catLoading ? (
            <p style={S.noResult}>Chargement…</p>
          ) : catDetail.length === 0 ? (
            <p style={S.noResult}>Aucune donnée pour cette catégorie.</p>
          ) : (
            <>
              {/* stats row */}
              <div style={S.statsRow}>
                <div style={S.statBox("#f97316")}>
                  <p style={S.statLabel}>Prix moyen</p>
                  <p style={S.statValue("#f97316")}>{fmtMAD(avgPrice)}</p>
                </div>
                <div style={S.statBox("#10b981")}>
                  <p style={S.statLabel}>Prix minimum</p>
                  <p style={S.statValue("#10b981")}>{fmtMAD(minPrice)}</p>
                </div>
                <div style={S.statBox("#ef4444")}>
                  <p style={S.statLabel}>Prix maximum</p>
                  <p style={S.statValue("#ef4444")}>{fmtMAD(maxPrice)}</p>
                </div>
                <div style={S.statBox("#94a3b8")}>
                  <p style={S.statLabel}>Points de données</p>
                  <p style={S.statValue("#94a3b8")}>{catDetail.length}</p>
                </div>
              </div>

              {/* area chart */}
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={catDetail} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => Math.round(v).toLocaleString()}
                  />
                  <Tooltip content={<AreaTooltip />} />
                  <Area
                    type="monotone" dataKey="min"
                    stroke="#10b981" strokeWidth={1.5}
                    fill="url(#gradMin)" dot={false} connectNulls
                    name="min"
                  />
                  <Area
                    type="monotone" dataKey="avg"
                    stroke="#f97316" strokeWidth={2.5}
                    fill="url(#gradAvg)" dot={false} connectNulls
                    name="avg"
                  />
                  <Area
                    type="monotone" dataKey="max"
                    stroke="#ef4444" strokeWidth={1.5}
                    fill="none" dot={false} connectNulls
                    strokeDasharray="4 4"
                    name="max"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                {[["#f97316","Prix moyen"],["#10b981","Minimum"],["#ef4444","Maximum (pointillé)"]].map(([c,l])=> (
                  <div key={l} style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#94a3b8" }}>
                    <span style={{ width:16,height:2,background:c,borderRadius:2,display:"inline-block" }} />
                    {l}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* LINE CHART — all categories evolution */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <p style={S.sectionTitle}>Évolution des prix par catégorie</p>
        </div>
        {categories.length > 0 ? (
          <>
            <div style={{ marginBottom: 14 }}>
              {lineKeys.map((k, i) => (
                <span key={k} style={S.tag(i)}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  {k}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={categories}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => Math.round(v).toLocaleString()} />
                <Tooltip content={<MultiTooltip />} />
                {lineKeys.map((key, i) => (
                  <Line
                    key={key} type="monotone" dataKey={key}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false} strokeWidth={2} connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p style={S.noResult}>Chargement…</p>
        )}
      </div>

      {/* PRODUCT SEARCH with autocomplete */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <p style={S.sectionTitle}>Recherche produit / catégorie</p>
        </div>
        <div style={S.searchRow}>
          <AutocompleteInput
            value={query}
            onChange={setQuery}
            onSelect={v => { setQuery(v); }}
            onSearch={handleSearch}
            placeholder="Rechercher… ex: samsung, iphone, sneakers, electronics"
            searching={searching}
          />
          <button style={S.btnOrange} onClick={handleSearch} disabled={searching}>
            {searching ? "…" : "Rechercher"}
          </button>
        </div>

      
  
        {searched && !searching && searchResults?.chartData?.length === 0 && (
          <p style={S.noResult}>Aucun produit trouvé pour «{query}».</p>
        )}
        {searchResults?.chartData?.length > 0 && (
          <>
            <div style={{ marginBottom: 14 }}>
              {searchResults.titles.map((t, i) => (
                <span key={t} style={S.tag(i)}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  {t.length > 45 ? t.slice(0, 43) + "…" : t}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={searchResults.chartData}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => Math.round(v).toLocaleString()} />
                <Tooltip content={<MultiTooltip />} />
                {searchResults.titles.map((t, i) => (
                  <Line
                    key={t} type="monotone" dataKey={t}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false} strokeWidth={2} connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

    </div>
  );
}

// ─── Autocomplete styles (outside component for perf) ─────────────────────────
const sx = {
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#f8f9fb",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    color: "#1e293b",
    fontSize: 13,
    padding: "11px 16px",
    outline: "none",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    zIndex: 100,
    maxHeight: 320,
    overflowY: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
  },
  dropLabel: {
    fontSize: 10, fontWeight: 700,
    color: "#94a3b8", textTransform: "uppercase",
    letterSpacing: "0.12em",
    margin: "10px 14px 4px",
  },
  dropItem: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 14px",
    fontSize: 13, color: "#475569",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  badge: (type) => ({
    fontSize: 9, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.08em",
    background: type === "cat" ? "#fff7ed" : "#eff6ff",
    color:      type === "cat" ? "#f97316" : "#3b82f6",
    borderRadius: 4, padding: "2px 6px", flexShrink: 0,
  }),
};
