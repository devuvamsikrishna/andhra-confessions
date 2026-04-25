import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { db, auth } from "./firebase";
import "./Admin.css";

const TABS = ["pending", "approved", "rejected", "reported"];

function formatTime(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Login Screen ─────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { setError("Enter email and password."); return; }
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid email or password.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login-box">
        <div className="admin-login-icon">🔐</div>
        <h1 className="admin-login-title">Admin Login</h1>
        <p className="admin-login-sub">Andhra Confessions Dashboard</p>

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@email.com"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        <div className="admin-field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        <button
          className="admin-login-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}

// ── Confession Row ───────────────────────────────────
function ConfessionRow({ confession, onApprove, onReject, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`admin-row ${confession.status || "pending"}`}>
      <div className="admin-row-top" onClick={() => setExpanded((p) => !p)}>
        <div className="admin-row-meta">
          <span className={`admin-status-badge ${confession.status || "pending"}`}>
            {confession.status || "pending"}
          </span>
          {confession.reported && (
            <span className="admin-status-badge reported">🚩 Reported</span>
          )}
          <span className="admin-mood-badge">{confession.mood || "Secret"}</span>
          <span className="admin-time">{formatTime(confession.createdAt)}</span>
        </div>
        <div className="admin-row-title">
          {confession.title || confession.text?.slice(0, 60) + "..."}
        </div>
        <div className="admin-row-name">Submitted by: <strong>{confession.name}</strong></div>
        <span className="admin-expand-icon">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="admin-row-body">
          {confession.title && (
            <p className="admin-confession-title">"{confession.title}"</p>
          )}
          <p className="admin-confession-text">{confession.text}</p>
          <div className="admin-confession-meta">
            <span>Code: <code>{confession.authenticCode}</code></span>
            <span>Reactions: {Object.values(confession.reactions || {}).reduce((a, b) => a + b, 0)}</span>
            <span>Comments: {confession.commentCount || 0}</span>
          </div>
          <div className="admin-actions">
            {confession.status !== "approved" && (
              <button
                className="admin-btn approve"
                onClick={() => onApprove(confession.id)}
              >
                ✓ Approve
              </button>
            )}
            {confession.status !== "rejected" && (
              <button
                className="admin-btn reject"
                onClick={() => onReject(confession.id)}
              >
                ✕ Reject
              </button>
            )}
            <button
              className="admin-btn delete"
              onClick={() => onDelete(confession.id)}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Dashboard ─────────────────────────────
export default function Admin() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [confessions, setConfessions] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Firestore listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "confessions"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setConfessions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleApprove(id) {
    try {
      await updateDoc(doc(db, "confessions", id), { status: "approved" });
      showToast("Confession approved ✓");
    } catch (err) {
      showToast("Failed to approve.", "error");
      console.error(err);
    }
  }

  async function handleReject(id) {
    try {
      await updateDoc(doc(db, "confessions", id), { status: "rejected" });
      showToast("Confession rejected.");
    } catch (err) {
      showToast("Failed to reject.", "error");
      console.error(err);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this confession permanently?")) return;
    try {
      await deleteDoc(doc(db, "confessions", id));
      showToast("Deleted permanently.", "error");
    } catch (err) {
      showToast("Failed to delete.", "error");
      console.error(err);
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  if (authLoading) {
    return <div className="admin-loading">Loading...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  const filtered = confessions.filter((c) => {
    const matchTab =
      activeTab === "reported"
        ? c.reported === true
        : (c.status || "pending") === activeTab;
    const matchSearch =
      search === "" ||
      c.text?.toLowerCase().includes(search.toLowerCase()) ||
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.authenticCode?.includes(search);
    return matchTab && matchSearch;
  });

  const counts = {
    pending: confessions.filter((c) => (c.status || "pending") === "pending").length,
    approved: confessions.filter((c) => c.status === "approved").length,
    rejected: confessions.filter((c) => c.status === "rejected").length,
    reported: confessions.filter((c) => c.reported === true).length,
  };

  return (
    <div className="admin-wrap">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <span className="admin-logo">⚙️</span>
          <div>
            <div className="admin-title">Admin Dashboard</div>
            <div className="admin-subtitle">Andhra Confessions</div>
          </div>
        </div>
        <div className="admin-header-right">
          <span className="admin-user">{user.email}</span>
          <button className="admin-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat">
          <div className="admin-stat-num">{confessions.length}</div>
          <div className="admin-stat-label">Total</div>
        </div>
        <div className="admin-stat pending">
          <div className="admin-stat-num">{counts.pending}</div>
          <div className="admin-stat-label">Pending</div>
        </div>
        <div className="admin-stat approved">
          <div className="admin-stat-num">{counts.approved}</div>
          <div className="admin-stat-label">Approved</div>
        </div>
        <div className="admin-stat rejected">
          <div className="admin-stat-num">{counts.rejected}</div>
          <div className="admin-stat-label">Rejected</div>
        </div>
        <div className="admin-stat reported">
          <div className="admin-stat-num">{counts.reported}</div>
          <div className="admin-stat-label">Reported</div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="admin-toolbar">
        <div className="admin-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`admin-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="admin-tab-count">{counts[tab]}</span>
            </button>
          ))}
        </div>
        <input
          className="admin-search"
          type="text"
          placeholder="Search by name, text, code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="admin-list">
        {filtered.length === 0 ? (
          <div className="admin-empty">No confessions here.</div>
        ) : (
          filtered.map((c) => (
            <ConfessionRow
              key={c.id}
              confession={c}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}