import { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";


//import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
//import { db, storage } from "./firebase";
import {db} from "./firebase";
import "./App.css";

const MOODS = ["Love", "Regret", "College", "Family", "Secret", "Funny"];
const FILTERS = ["All", ...MOODS];
const REACTIONS = [
  { key: "heart", icon: "❤", label: "Felt this" },
  { key: "tears", icon: "🥲", label: "Emotional" },
  { key: "shock", icon: "😮", label: "Surprised" },
  { key: "hug", icon: "🫂", label: "Support" },
];

function isApproved(confession) {
  return confession.status === "approved" || !confession.status;
}

function generateAuthenticCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getSafeFileName(fileName) {
  return fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
}

function getConfessionImages(confession) {
  if (Array.isArray(confession.imageUrls)) return confession.imageUrls;
  return confession.imageUrl ? [confession.imageUrl] : [];
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not prepare image."));
        return;
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("Could not compress image."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.78
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image."));
    };

    image.src = objectUrl;
  });
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

// ── Confession Card ──────────────────────────────────────────────
function ConfessionCard({ confession, isNew, isCotd, getReactionCount, onReact, onShare }) {
  const images = getConfessionImages(confession);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    if (!commentsOpen) return;
    setCommentsLoading(true);
    const q = query(
      collection(db, "confessions", confession.id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCommentsLoading(false);
    });
    return () => unsub();
  }, [commentsOpen, confession.id]);

  async function handleCommentSubmit() {
  const trimmed = commentText.trim();
  if (!trimmed) return;
  setCommentSubmitting(true);
  try {
    // Add the comment
    await addDoc(collection(db, "confessions", confession.id, "comments"), {
      text: trimmed,
      createdAt: serverTimestamp(),
    });

    // ← Add this: increment the count on the parent confession
    await updateDoc(doc(db, "confessions", confession.id), {
      commentCount: increment(1),
    });

    setCommentText("");
  } catch (err) {
    console.error(err);
  } finally {
    setCommentSubmitting(false);
  }
}

  return (
    <div id={`confession-${confession.id}`} className={`card ${isNew ? "card--new" : ""} ${isCotd ? "card--cotd" : ""}`}>
      {isCotd && (
        <div className="cotd-badge">🏆 Confession of the Day</div>
      )}
      <div className="card-topline">
        <div className="card-quote-mark">"</div>
        <span className="card-mood">{confession.mood || "Secret"}</span>
      </div>
      {confession.title && (
        <h3 className="card-title">{confession.title}</h3>
      )}
      <p className="card-text">{confession.text}</p>

      {images.length > 0 && (
        <div className={`card-images card-images--${Math.min(images.length, 5)}`}>
          {images.map((imageUrl, index) => (
            <img
              key={imageUrl}
              className="card-image"
              src={imageUrl}
              alt={`Attached confession ${index + 1}`}
              loading="lazy"
            />
          ))}
        </div>
      )}

      <div className="reaction-row">
        {REACTIONS.map((reaction) => (
          <button
            key={reaction.key}
            className="reaction-btn"
            onClick={() => onReact(confession.id, reaction.key)}
          >
            {reaction.icon} {getReactionCount(confession, reaction.key)}
          </button>
        ))}
        <button className="reaction-btn share-btn" onClick={() => onShare(confession)}>
          ↗ Share
        </button>
      </div>

      {/* Comments toggle */}
      <button
        className="comments-toggle"
        onClick={() => setCommentsOpen((prev) => !prev)}
      >
        {commentsOpen 
  ? `Hide comments (${comments.length})` 
  : `View comments (${confession.commentCount || 0})`}
      </button>

      {commentsOpen && (
        <div className="comments-section">
          {commentsLoading ? (
            <p className="comments-empty">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="comments-empty">No comments yet. Be the first.</p>
          ) : (
            <div className="comments-list">
              {comments.map((c) => (
                <div key={c.id} className="comment">
                  <span className="comment-text">{c.text}</span>
                  <span className="comment-time">{formatTime(c.createdAt)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="comment-input-row">
            <input
              type="text"
              className="comment-input"
              placeholder="Write an anonymous comment..."
              value={commentText}
              maxLength={200}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !commentSubmitting && handleCommentSubmit()}
            />
            <button
              className="comment-submit"
              onClick={handleCommentSubmit}
              disabled={commentSubmitting || !commentText.trim()}
            >
              {commentSubmitting ? "..." : "Post"}
            </button>
          </div>
        </div>
      )}

      <div className="card-footer">
        <span className="card-anon">Anonymous</span>
        <span className="card-time">{formatTime(confession.createdAt)}</span>
      </div>
    </div>
  );
}
function formatTime(ts) {
  if (!ts) return "just now";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function getDateValue(ts) {
  if (!ts) return 0;
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.getTime();
}

// ── Main App ─────────────────────────────────────────────────────
export default function App() {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [mood, setMood] = useState("Secret");
  const [images, setImages] = useState([]);
  const [authenticCode, setAuthenticCode] = useState("");
  const [codePopupOpen, setCodePopupOpen] = useState(false);
  const [confessions, setConfessions] = useState([]);
  const [feedMode, setFeedMode] = useState("latest");
  const [moodFilter, setMoodFilter] = useState("All");
  const [wallLoading, setWallLoading] = useState(true);
  const [wallError, setWallError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [toast, setToast] = useState(null);
  const [newIds, setNewIds] = useState(new Set());
  const [feedVisible, setFeedVisible] = useState(false);
  const toastTimer = useRef(null);
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("dark"); // default




  // Load saved theme
useEffect(() => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    setTheme(savedTheme);
  }
}, []);

// Apply theme to body
useEffect(() => {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}, [theme]);


  // Real-time Firestore listener
  useEffect(() => {
    setWallLoading(true);
    setWallError("");
    const q = query(
      collection(db, "confessions"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setConfessions(docs);
        setFeedVisible(true);
        setWallLoading(false);
      },
      (err) => {
        console.error(err);
        setWallError("Could not load the wall right now.");
        setFeedVisible(true);
        setWallLoading(false);
      }
    );
    return () => unsub();
  }, []);

  function showToast(msg, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  // function handleImageChange(event) {
  //   const selectedFiles = Array.from(event.target.files || []);
  //   if (selectedFiles.length === 0) return;

  //   const hasInvalidFile = selectedFiles.some((file) => !file.type.startsWith("image/"));
  //   const hasLargeFile = selectedFiles.some((file) => file.size > 5 * 1024 * 1024);

  //   if (hasInvalidFile) {
  //     showToast("Please attach an image file.", "error");
  //     event.target.value = "";
  //     return;
  //   }

  //   if (hasLargeFile) {
  //     showToast("Each image must be under 5 MB.", "error");
  //     event.target.value = "";
  //     return;
  //   }

  //   if (images.length + selectedFiles.length > 5) {
  //     showToast("Only the first 5 images were added.", "error");
  //   }

  //   setImages((prev) => {
  //     const openSlots = Math.max(0, 5 - prev.length);
  //     const filesToAdd = selectedFiles.slice(0, openSlots);
  //     return [
  //       ...prev,
  //       ...filesToAdd.map((file) => ({
  //         file,
  //         previewUrl: URL.createObjectURL(file),
  //       })),
  //     ];
  //   });
  //   event.target.value = "";
  // }

  // function removeImage(indexToRemove) {
  //   setImages((prev) => {
  //     const imageToRemove = prev[indexToRemove];
  //     if (imageToRemove) URL.revokeObjectURL(imageToRemove.previewUrl);
  //     return prev.filter((_, index) => index !== indexToRemove);
  //   });
  // }

  // function clearImages() {
  //   setImages((prev) => {
  //     prev.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  //     return [];
  //   });
  // }

  async function handleSubmit() {
    const trimName = name.trim();
    const trimText = text.trim();
    const trimTitle = title.trim();
    if (!trimName) { showToast("Please enter your name.", "error"); return; }
    if (!trimText) { showToast("Write something first.", "error"); return; }
    if (!trimTitle) { showToast("Please add a title.", "error"); return; }

    setLoading(true);
    setSubmitStatus(images.length > 0 ? "Preparing images..." : "Submitting confession...");
    try {
      const generatedCode = generateAuthenticCode();
      // const imageUploads = await Promise.all(
      //   images.map(async ({ file }, index) => {
      //     setSubmitStatus(`Uploading image ${index + 1} of ${images.length}...`);
      //     const imagePath = `confession-images/${generatedCode}-${Date.now()}-${index + 1}-${getSafeFileName(file.name)}`;
      //     const imageRef = ref(storage, imagePath);
      //     const compressedImage = await compressImage(file);
      //     await withTimeout(
      //       uploadBytes(imageRef, compressedImage, {
      //         contentType: "image/jpeg",
      //         customMetadata: { authenticCode: generatedCode },
      //       }),
      //       45000,
      //       "Image upload took too long. Please try smaller images or check Firebase Storage rules."
      //     );
      //     return {
      //       imagePath,
      //       imageUrl: await withTimeout(
      //         getDownloadURL(imageRef),
      //         15000,
      //         "Could not get uploaded image URL."
      //       ),
      //     };
      //   })
      // );

      const imageUploads = []; // Remove this line when enabling image uploads
      setSubmitStatus("Saving confession...");
      const imageUrls = [];
      const imagePaths = [];

      //const imageUrls = imageUploads.map((image) => image.imageUrl);
      //const imagePaths = imageUploads.map((image) => image.imagePath);

      const docRef = await withTimeout(
        addDoc(collection(db, "confessions"), {
          name: trimName,
          text: trimText,
          title: trimTitle,
          mood,
          authenticCode: generatedCode,
          imageUrls,
          imagePaths,
          status: "pending",
          reactions: REACTIONS.reduce((acc, reaction) => {
            acc[reaction.key] = 0;
            return acc;
          }, {}),
          createdAt: serverTimestamp(),
        }),
        20000,
        "Confession save took too long. Please try again."
      );

      // Mark as new for animation
      setNewIds((prev) => new Set([...prev, docRef.id]));
      setTimeout(() => {
        setNewIds((prev) => {
          const n = new Set(prev); n.delete(docRef.id); return n;
        });
      }, 1500);

      setName("");
      setText("");
      setMood("Secret");
      setTitle("");
      clearImages();
      setAuthenticCode(generatedCode);
      setCodePopupOpen(true);
      showToast("Sent for approval. It will appear after review.");
    } catch (err) {
      console.error(err);
      showToast(
        err?.code === "storage/unauthorized"
          ? "Firebase Storage rules are blocking image uploads."
          : err?.message || "Something went wrong. Try again.",
        "error"
      );
    } finally {
      setLoading(false);
      setSubmitStatus("");
    }
  }

  async function handleReact(confessionId, reactionKey) {
    try {
      await updateDoc(doc(db, "confessions", confessionId), {
        [`reactions.${reactionKey}`]: increment(1),
      });
    } catch (err) {
      console.error(err);
      const isPermissionError = err?.code === "permission-denied";
      showToast(
        isPermissionError
          ? "Update Firestore rules to allow reactions."
          : "Reaction could not be saved.",
        "error"
      );
    }
  }

  function getReactionCount(confession, reactionKey) {
    return confession.reactions?.[reactionKey] || 0;
  }

  function getTotalReactions(confession) {
    return REACTIONS.reduce(
      (total, reaction) => total + getReactionCount(confession, reaction.key),
      0
    );
  }

  async function handleShare(confession) {
    const shareUrl = `${window.location.origin}/#confession-${confession.id}`;
    const shareData = {
      title: "Andhra Confessions",
      text: `"${confession.text.slice(0, 120)}${confession.text.length > 120 ? "..." : ""}"`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareUrl}`);
        showToast("Share link copied.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error(err);
        showToast("Could not share this confession.", "error");
      }
    }
  }

  const approvedConfessions = confessions.filter(isApproved);

// Confession of the day — most reacted in last 24 hours
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
const cotd = approvedConfessions.reduce((best, c) => {
  if (getDateValue(c.createdAt) < oneDayAgo) return best;
  if (!best) return c;
  return getTotalReactions(c) > getTotalReactions(best) ? c : best;
}, null);

const filteredConfessions = approvedConfessions.filter((confession) => {
  return moodFilter === "All" || (confession.mood || "Secret") === moodFilter;
});

const displayedConfessions = [...filteredConfessions].sort((a, b) => {
  if (feedMode === "popular") {
    const reactionDiff = getTotalReactions(b) - getTotalReactions(a);
    if (reactionDiff !== 0) return reactionDiff;
  }
  return getDateValue(b.createdAt) - getDateValue(a.createdAt);
});

  const charLeft = 500 - text.length;

  return (
    <div className="app">
      {/* Background effects */}
      <div className="bg-orb bg-orb--1" />
      <div className="bg-orb bg-orb--2" />
      <div className="grain" />

      {/* ── Header ── */}
      <header className="site-header">
  <div className="theme-switcher">
    <button
      className={theme === "light" ? "active" : ""}
      onClick={() => setTheme("light")}
    >
      ☀️
    </button>

    <button
      className={theme === "dark" ? "active" : ""}
      onClick={() => setTheme("dark")}
    >
      🌙
    </button>

    <button
      className={theme === "confession" ? "active" : ""}
      onClick={() => setTheme("confession")}
    >
      🔥
    </button>
  </div>

  <p className="eyebrow">A wall of honest words</p>
  <h1 className="site-title">
    <span className="title-plain">Andhra </span>
    <span className="title-italic title-highlight">Confessions</span>
  </h1>
  <p className="site-sub">Say what you've never said out loud.</p>
</header>

      <main className="layout">

        {/* ── Form panel ── */}
        <section className="form-panel">
          <div className="panel-label">Confess</div>

          <div className="field">
            <label htmlFor="name">Your Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              maxLength={60}
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label>Choose a Mood</label>
            <div className="mood-grid" role="group" aria-label="Choose a mood">
              {MOODS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`mood-chip ${mood === item ? "mood-chip--active" : ""}`}
                  onClick={() => setMood(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="field">
            <label htmlFor="title">Confession Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your confession a title..."
              maxLength={80}
            />
          </div>
            <label htmlFor="text">Your Confession</label>
            <textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Speak freely. No one will know it's you."
              maxLength={500}
            />
            <span className={`char-count ${charLeft < 60 ? "warn" : ""}`}>
              {charLeft} left
            </span>
          </div>

          {/* <div className="field">
            <label htmlFor="image">Attach Pictures</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
            />
            <span className="image-help">{images.length}/5 images selected</span>
            {images.length > 0 && (
              <div className="image-preview-grid">
                {images.map((image, index) => (
                  <div className="image-preview" key={`${image.file.name}-${image.file.lastModified}-${index}`}>
                    <img src={image.previewUrl} alt={`Selected preview ${index + 1}`} />
                    <button type="button" onClick={() => removeImage(index)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div> */}

          <button
            className={`submit-btn ${loading ? "loading" : ""}`}
            onClick={handleSubmit}
            disabled={loading}
          >
            <span className="btn-label">
              {loading ? submitStatus || "Sending..." : "Submit for Approval"}
            </span>
            {loading && <span className="btn-spinner" />}
          </button>

          {loading && submitStatus && (
            <p className="submit-status" role="status">{submitStatus}</p>
          )}

          <p className="form-note">
            Names are used only for review and are never shown publicly.
          </p>
        </section>

        {/* ── Feed panel ── */}
        <section className={`feed-panel ${feedVisible ? "feed--visible" : ""}`}>
          <div className="feed-header">
            <div className="panel-label">
              The Wall
              <span className="feed-count">{approvedConfessions.length}</span>
            </div>
            <div className="feed-tabs" role="tablist" aria-label="Sort confessions">
              <button
                type="button"
                className={`feed-tab ${feedMode === "latest" ? "feed-tab--active" : ""}`}
                onClick={() => setFeedMode("latest")}
              >
                Latest
              </button>
              <button
                type="button"
                className={`feed-tab ${feedMode === "popular" ? "feed-tab--active" : ""}`}
                onClick={() => setFeedMode("popular")}
              >
                Popular
              </button>
            </div>
          </div> 
          <div className="filter-row" role="group" aria-label="Filter by mood">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button" 
                className={`filter-chip ${moodFilter === item ? "filter-chip--active" : ""}`}
                onClick={() => setMoodFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {wallLoading ? (
            <div className="feed-empty">
              <div className="empty-quote">"</div>
              <p>Loading the wall...</p>
              <p>Honest words are on the way.</p>
            </div>
          ) : wallError ? (
            <div className="feed-empty feed-empty--error">
              <div className="empty-quote">!</div>
              <p>{wallError}</p>
              <p>Please try refreshing in a moment.</p>
            </div>
          ) : approvedConfessions.length === 0 ? (
            <div className="feed-empty">
              <div className="empty-quote">"</div>
              <p>The wall is quiet.</p>
              <p>Be the first voice.</p>
            </div>
          ) : displayedConfessions.length === 0 ? (
            <div className="feed-empty">
              <div className="empty-quote">"</div>
              <p>No {moodFilter.toLowerCase()} confessions yet.</p>
              <p>Try another mood filter.</p>
            </div>
          ) : (
            <div className="feed">
              {displayedConfessions.map((c) => (
                <ConfessionCard
                  key={c.id}
                  confession={c}
                  isNew={newIds.has(c.id)}
                  isCotd={cotd?.id === c.id}
                  getReactionCount={getReactionCount}
                  onReact={handleReact}
                  onShare={handleShare}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast toast--${toast.type}`}>{toast.msg}</div>
      )}

      {codePopupOpen && authenticCode && (
        <div className="modal-backdrop" role="presentation">
          <div className="code-modal" role="dialog" aria-modal="true" aria-labelledby="code-title">
            <div className="code-modal-icon">✓</div>
            <h2 id="code-title">Submitted for Approval</h2>
            <p className="code-modal-copy">
              Your confession has been submitted. Contact the admin and share this authentic code for approval.
            </p>
            <div className="code-modal-value">
              Authentic code is : <strong>{authenticCode}</strong>
            </div>
      
            <button
              type="button"
              className="code-modal-btn"
              onClick={() => setCodePopupOpen(false)}
            >
              I understand
            </button>
          </div>
        </div>
      )}

      {/* ── Contact Us ── */}
      <footer className="site-footer">
        <div>
          <div className="contact-label">Contact Us</div>
          <p className="contact-copy">Follow updates and send feedback.</p>
        </div>
        <a
          href="https://instagram.com/YOUR_INSTAGRAM_HANDLE"
          className="contact-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            className="contact-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="insta-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f58529" />
                <stop offset="30%" stopColor="#dd2a7b" />
                <stop offset="60%" stopColor="#8134af" />
                <stop offset="100%" stopColor="#515bd4" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#insta-gradient)" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="#fff" />
            <circle cx="17.5" cy="6.5" r="1.5" fill="#fff" />
          </svg>
          Instagram
        </a>

        <a
  href="https://t.me/YOUR_TELEGRAM_USERNAME"
  className="contact-link"
  target="_blank"
  rel="noopener noreferrer"
>
  <svg
    className="contact-icon"
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      fill="#229ED9"
      d="M9.04 15.47l-.38 5.32c.54 0 .77-.23 1.05-.5l2.52-2.41 5.22 3.82c.96.53 1.64.25 1.89-.89l3.43-16.08.01-.01c.3-1.39-.5-1.93-1.44-1.58L1.55 9.52c-1.35.53-1.33 1.29-.23 1.63l4.9 1.53L18.62 6.4c.58-.36 1.11-.16.68.2"
    />
  </svg>
  Telegram
</a>

      </footer>
    </div>
  );
}