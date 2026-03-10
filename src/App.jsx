import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are a certified Land Rover Discovery 3 (LR3/Disco 3) specialist with 20+ years of hands-on experience. You have deep knowledge of every system: electronics, CANbus architecture, air suspension (EAS), engine variants (2.7 TDV6, TDV8, 4.4 V8), drivetrain, and the notoriously quirky electrical gremlins this platform is known for.

YOU HAVE WEB SEARCH. Use it proactively when:
- The user describes a specific fault code or unusual symptom
- You want to check if there's a known fix on Disco3.co.uk, LR4x4.com, or DefenderSource forums
- You need to verify a part number or recall
- A problem sounds like it might have a TSB (Technical Service Bulletin)
Search naturally as part of your diagnostic process. Don't announce that you're searching — just do it and weave the findings into your answer.

YOUR DIAGNOSTIC STYLE:
- Talk like an experienced mechanic, NOT a textbook. Be direct and conversational.
- Don't dump everything at once. Ask one or two targeted questions, then narrow down.
- Lead with the most common Disco 3 failure pattern for that symptom.
- Use real-world language: "the rear nearside height sensor arm — it's the little plastic link, snaps like a twig"
- Keep responses focused: one diagnosis, one next step, or one key question at a time.
- If a job is genuinely risky or complex, say so plainly.

KEY KNOWLEDGE:

AIR SUSPENSION / EAS (most common failure area):
1. Compressor failure — worn brushes, seized pump, burnt relay. Check relay in rear fusebox first.
2. Height sensor failure — rear sensors, brittle plastic arms snap. Causes "Suspension Fault".
3. Air bag leaks — soap test on bags and corner valve blocks, worse in cold weather.
4. Corner valve block — solenoid failure, one corner drops, usually audible hissing.
5. EAS ECU — less common, diagnose after ruling out above.

2.7 TDV6 ENGINE (most common variant):
1. EGR valve/cooler failure — soot buildup, rough idle, black smoke. Cracked EGR cooler = white smoke = urgent.
2. Turbo actuator (VNT) — P0299/P0234. Actuator motor fails before the turbo itself. Check with diagnostic first.
3. Swirl flap failure — plastic flaps disintegrate and get ingested. Blank them. Non-negotiable on high mileage.
4. Injector sealing washers — ticking on cold start. Copper washers harden.
5. Crank/cam sensor — no-start or stalling. P0335, P0340. Check wiring loom for chafing first.
6. Oil cooler seal — oil into coolant. Check coolant for oily sheen.
7. Timing chain tensioner — rattle on cold start. Catastrophic if ignored.

ELECTRICAL / CANBUS:
- Weak battery causes cascading false faults across multiple modules. Test under load first.
- Ground straps (engine-to-chassis, body-to-chassis, battery negative) — corrosion causes bizarre multi-system faults.
- Alternator should be 13.8–14.4V at idle.
- Tail gate loom breaks at hinge — causes multiple rear light/sensor faults.
- Sunroof drain blockage → water ingress → corrodes fuse connections.

DRIVETRAIN:
- IRD unit — oil seal failure, oil loss, whine. Often empty on neglected cars.
- Haldex coupling — service filter/oil or it disengages 4WD silently.
- Front lower control arm bushings — knock over bumps.

FAULT CODES:
- P0299/P0234: VNT actuator (not turbo itself)
- P0335: Crank sensor or loom chafe
- P0401: EGR valve sooted/stuck
- C1A0x: EAS height sensor (check arm first)
- U0100: CANbus — battery/ground issue first
- B1A4x: BeCM — voltage instability

Format your responses with clear sections when listing causes. Use emoji sparingly for system indicators: 🔵 for suspension/EAS, 🔴 for engine, 🟡 for electrical, 🟢 for drivetrain. Keep it punchy and practical.`;

const WELCOME_MESSAGE = {
  role: "assistant",
  content: `Alright, let's have a look at your Disco 3.\n\nWhat's it doing? Give me the symptoms — warning lights, noises, when it happens, and your mileage if you know it. The more specific, the faster we'll nail it.`
};

const TOOLS = [
  {
    type: "web_search_20250305",
    name: "web_search"
  }
];

export default function LR3Diagnostic() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, searching]);

  const callAPI = async (msgs) => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: msgs
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const newMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setSearching(false);
    setError(null);

    try {
      let apiMessages = newMessages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

      let data = await callAPI(apiMessages);

      // Agentic loop: handle tool use (web search)
      while (data.stop_reason === "tool_use") {
        setSearching(true);

        const assistantMsg = { role: "assistant", content: data.content };
        apiMessages = [...apiMessages, assistantMsg];

        const toolResults = data.content
          .filter(b => b.type === "tool_use")
          .map(b => ({
            type: "tool_result",
            tool_use_id: b.id,
            content: b.content || ""
          }));

        apiMessages = [...apiMessages, { role: "user", content: toolResults }];
        data = await callAPI(apiMessages);
      }

      setSearching(false);

      const reply = data.content
        ?.filter(b => b.type === "text")
        .map(b => b.text)
        .join("\n") || "No response.";

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError("Connection failed. Check your API key and network.");
      console.error(err);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatContent = (text) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("# ")) return <h3 key={i} style={styles.h3}>{line.slice(2)}</h3>;
      if (line.startsWith("## ")) return <h4 key={i} style={styles.h4}>{line.slice(3)}</h4>;
      if (line.match(/^\d+\.\s/)) return <p key={i} style={styles.listItem}>{line}</p>;
      if (line.startsWith("- ")) return <p key={i} style={styles.bullet}>• {line.slice(2)}</p>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} style={styles.bold}>{line.slice(2, -2)}</p>;
      if (line === "") return <br key={i} />;
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((p, j) => p.startsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p);
      return <p key={i} style={styles.para}>{rendered}</p>;
    });
  };

  return (
    <div style={styles.root}>
      <div style={styles.scanlines} />

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="1" y="1" width="34" height="34" rx="2" stroke="#C8A84B" strokeWidth="1.5"/>
              <path d="M7 18 L18 8 L29 18 L24 18 L24 28 L12 28 L12 18 Z" fill="#C8A84B" opacity="0.9"/>
              <circle cx="18" cy="19" r="3" fill="#1a1a1a" stroke="#C8A84B" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoText}>LR3 DIAGNOSTIC</div>
            <div style={styles.logoSub}>DISCOVERY 3 · EXPERT SYSTEM</div>
          </div>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusDot} />
          SYSTEM ONLINE
        </div>
      </header>

      <div style={styles.systemTags}>
        {[
          { color: "#4A9EFF", label: "🔵 EAS / Suspension" },
          { color: "#FF5C5C", label: "🔴 TDV6 Engine" },
          { color: "#F5C518", label: "🟡 Electrical" },
          { color: "#5CCC7A", label: "🟢 Drivetrain" },
        ].map(t => (
          <span key={t.label} style={{ ...styles.tag, borderColor: t.color + "55", color: t.color }}>
            {t.label}
          </span>
        ))}
      </div>

      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === "user" ? styles.userBubbleWrap : styles.aiBubbleWrap}>
            {m.role === "assistant" && <div style={styles.mechanicBadge}>MECH</div>}
            <div style={m.role === "user" ? styles.userBubble : styles.aiBubble}>
              {m.role === "assistant" ? formatContent(m.content) : m.content}
            </div>
            {m.role === "user" && <div style={styles.userBadge}>YOU</div>}
          </div>
        ))}

        {searching && (
          <div style={styles.aiBubbleWrap}>
            <div style={styles.mechanicBadge}>MECH</div>
            <div style={{ ...styles.aiBubble, ...styles.searchingBubble }}>
              <span style={styles.searchIcon}>🔍</span>
              <span style={styles.searchingText}>Checking forums and tech docs…</span>
            </div>
          </div>
        )}

        {loading && !searching && (
          <div style={styles.aiBubbleWrap}>
            <div style={styles.mechanicBadge}>MECH</div>
            <div style={styles.aiBubble}>
              <div style={styles.typingDots}>
                <span style={{ ...styles.dot, animationDelay: "0ms" }} />
                <span style={{ ...styles.dot, animationDelay: "180ms" }} />
                <span style={{ ...styles.dot, animationDelay: "360ms" }} />
              </div>
            </div>
          </div>
        )}

        {error && <div style={styles.errorBox}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputArea}>
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describe your symptoms… warning lights, noises, when it happens"
          rows={2}
          disabled={loading}
        />
        <button
          style={{ ...styles.sendBtn, opacity: loading || !input.trim() ? 0.4 : 1 }}
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div style={styles.hint}>Press Enter to send · Shift+Enter for new line</div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&family=Noto+Sans:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #C8A84B55; border-radius: 2px; }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.7} }
        @keyframes searchPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        textarea:focus { border-color: #C8A84B55 !important; }
      `}</style>
    </div>
  );
}

const styles = {
  root: {
    height: "100vh",
    background: "#0e0e0e",
    backgroundImage: "radial-gradient(ellipse at 20% 0%, #1a1408 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, #0a1a0a 0%, transparent 60%)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Noto Sans', sans-serif",
    color: "#d4cfc0",
    position: "relative",
    overflow: "hidden",
  },
  scanlines: {
    position: "fixed",
    inset: 0,
    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)",
    pointerEvents: "none",
    zIndex: 10,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid #C8A84B33",
    background: "linear-gradient(180deg, #161409 0%, #0e0e0e 100%)",
    flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  logoText: {
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    color: "#C8A84B",
    letterSpacing: "0.12em",
    lineHeight: 1,
  },
  logoSub: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 9,
    color: "#6b6450",
    letterSpacing: "0.2em",
    marginTop: 3,
  },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    color: "#5CCC7A",
    letterSpacing: "0.15em",
    border: "1px solid #5CCC7A44",
    padding: "4px 10px",
    borderRadius: 2,
  },
  statusDot: {
    width: 6, height: 6, borderRadius: "50%",
    background: "#5CCC7A",
    animation: "pulse 2s ease-in-out infinite",
    display: "inline-block",
  },
  systemTags: {
    display: "flex",
    gap: 6,
    padding: "8px 20px",
    borderBottom: "1px solid #1f1f1f",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  tag: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    padding: "3px 8px",
    border: "1px solid",
    borderRadius: 2,
    letterSpacing: "0.05em",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  aiBubbleWrap: {
    display: "flex", alignItems: "flex-start", gap: 8,
    maxWidth: "85%", alignSelf: "flex-start",
  },
  userBubbleWrap: {
    display: "flex", alignItems: "flex-start", gap: 8,
    maxWidth: "75%", alignSelf: "flex-end", flexDirection: "row-reverse",
  },
  mechanicBadge: {
    fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 9,
    color: "#C8A84B", background: "#1a1408", border: "1px solid #C8A84B44",
    padding: "3px 5px", borderRadius: 2, letterSpacing: "0.1em",
    flexShrink: 0, marginTop: 4,
  },
  userBadge: {
    fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 9,
    color: "#4A9EFF", background: "#080e1a", border: "1px solid #4A9EFF44",
    padding: "3px 5px", borderRadius: 2, letterSpacing: "0.1em",
    flexShrink: 0, marginTop: 4,
  },
  aiBubble: {
    background: "#141410", border: "1px solid #2a2720",
    borderLeft: "3px solid #C8A84B", borderRadius: "0 4px 4px 4px",
    padding: "12px 16px", fontSize: 14, lineHeight: 1.65, color: "#ccc8bc",
  },
  searchingBubble: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderLeft: "3px solid #4A9EFF",
    animation: "searchPulse 1.5s ease-in-out infinite",
  },
  searchIcon: { fontSize: 14 },
  searchingText: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    color: "#4A9EFF",
    letterSpacing: "0.05em",
  },
  userBubble: {
    background: "#080e1a", border: "1px solid #1a2440",
    borderRight: "3px solid #4A9EFF", borderRadius: "4px 0 4px 4px",
    padding: "12px 16px", fontSize: 14, lineHeight: 1.65, color: "#b0bdd4",
    whiteSpace: "pre-wrap",
  },
  para: { marginBottom: 6, fontSize: 14 },
  h3: {
    fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 16,
    color: "#C8A84B", letterSpacing: "0.08em", marginBottom: 8, marginTop: 4,
  },
  h4: {
    fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: 14,
    color: "#a89060", letterSpacing: "0.06em", marginBottom: 6, marginTop: 4,
  },
  listItem: { paddingLeft: 4, marginBottom: 5, fontSize: 14, color: "#c4c0b4" },
  bullet: { paddingLeft: 8, marginBottom: 4, fontSize: 14, color: "#b0ac9e" },
  bold: { fontWeight: 600, color: "#d8d4c4", marginBottom: 4, fontSize: 14 },
  typingDots: { display: "flex", gap: 5, padding: "4px 2px" },
  dot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#C8A84B", animation: "pulse 1.2s ease-in-out infinite",
    display: "inline-block",
  },
  errorBox: {
    background: "#1a0808", border: "1px solid #FF5C5C55", color: "#FF5C5C",
    padding: "10px 14px", borderRadius: 4, fontSize: 13,
    fontFamily: "'Share Tech Mono', monospace",
  },
  inputArea: {
    display: "flex", gap: 10, padding: "12px 20px 8px",
    borderTop: "1px solid #1f1c14", background: "#0c0c0a", flexShrink: 0,
  },
  textarea: {
    flex: 1, background: "#111108", border: "1px solid #2e2a1e",
    borderRadius: 4, color: "#d4cfc0", fontFamily: "'Noto Sans', sans-serif",
    fontSize: 14, lineHeight: 1.6, padding: "10px 14px",
    resize: "none", outline: "none", transition: "border-color 0.2s",
  },
  sendBtn: {
    width: 46, height: 46, background: "#C8A84B", border: "none",
    borderRadius: 4, cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
    transition: "opacity 0.2s", alignSelf: "flex-end",
  },
  hint: {
    fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#3a3730",
    textAlign: "center", padding: "4px 0 10px", letterSpacing: "0.12em",
    flexShrink: 0,
  },
};
