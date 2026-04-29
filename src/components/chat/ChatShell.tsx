"use client";

export type ChatShellMessage = {
  id: string;
  content: string;
  sender_type?: string | null;
  message_type?: "text" | "image" | "video" | "audio" | "file";
  file_url?: string | null;
  file_name?: string | null;
};

type ChatShellLabels = {
  messagePlaceholder?: string;
  photos?: string;
  video?: string;
  documents?: string;
  quickReplies?: string;
  settings?: string;
};

type ChatShellProps = {
  messages: ChatShellMessage[];
  message: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onMic: () => void;
  onCamera: () => void;
  onPlusClick: () => void;
  mode: "patient" | "staff";
  menuOpen?: boolean;
  onQuickReply?: (reply: string) => void;
  quickRepliesOpen?: boolean;
  quickReplies?: string[];
  labels?: ChatShellLabels;
  onPhotos?: () => void;
  onVideo?: () => void;
  onDocuments?: () => void;
  onQuickRepliesOpen?: () => void;
  onSettings?: () => void;
};

export default function ChatShell({
  messages,
  message,
  onChange,
  onSend,
  onMic,
  onCamera,
  onPlusClick,
  mode,
  menuOpen = false,
  onQuickReply,
  quickRepliesOpen = false,
  quickReplies = [],
  labels = {},
}: ChatShellProps) {
  const textPrimary = "#111";
  const footerBg = "#ededed";
  const inputPanelBg = "#fff";
  const messageFontSize = 16;
  const roundButtonStyle = {
    width: 58,
    height: 58,
    borderRadius: "50%",
    border: "none",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  } as const;
  const menuButtonStyle = {
    display: "block",
    width: "100%",
    border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    color: "#111",
    padding: "15px 16px",
    textAlign: "left" as const,
    fontSize: 17,
    fontWeight: 800,
  };

  const renderMessage = (entry: ChatShellMessage) => {
    const url = entry.file_url || entry.content;

    if (entry.message_type === "image") {
      return <img src={url} alt={entry.file_name || "Image"} style={{ display: "block", maxWidth: "100%", maxHeight: 280, borderRadius: 10, objectFit: "contain" }} />;
    }

    if (entry.message_type === "video") {
      return <video src={url} controls style={{ display: "block", width: "100%", maxHeight: 280, borderRadius: 10 }} />;
    }

    if (entry.message_type === "audio") {
      return <audio src={url} controls style={{ width: "240px", maxWidth: "100%" }} />;
    }

    if (entry.message_type === "file") {
      return (
        <a href={url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, color: "#075e54", textDecoration: "none", fontWeight: 700 }}>
          <span style={{ fontSize: 24 }}>📄</span>
          <span style={{ wordBreak: "break-word" }}>{entry.file_name || "Download file"}</span>
        </a>
      );
    }

    return <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.content}</span>;
  };

  return (
    <main style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#f7f7f7", color: textPrimary, fontFamily: "Arial, Helvetica, sans-serif", overflow: "hidden" }}>
      <style>{`
        button { transition: transform 150ms ease, opacity 150ms ease, background-color 150ms ease, box-shadow 150ms ease; }
        button:active { transform: scale(0.96); opacity: 0.86; }
        input { transition: box-shadow 170ms ease, background-color 170ms ease; }
        input:focus { box-shadow: 0 0 0 3px rgba(30,136,229,0.18); }
        @keyframes messageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes menuIn { from { opacity: 0; transform: scale(0.96) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>

      <section style={{ flex: 1, overflowY: "auto", padding: "14px 10px 18px" }}>
        {messages.map((entry) => {
          const outgoing = mode === "staff" ? entry.sender_type === "staff" : entry.sender_type !== "staff";
          const bubbleBg = outgoing ? "#fff" : "#d9ecf7";

          return (
            <div key={entry.id} style={{ display: "flex", justifyContent: outgoing ? "flex-end" : "flex-start", marginBottom: 8, animation: "messageIn 180ms ease-out" }}>
              <div style={{ maxWidth: "70%", background: bubbleBg, color: "#0f172a", borderRadius: outgoing ? "12px 4px 12px 12px" : "4px 12px 12px 12px", padding: "11px 13px", boxShadow: "0 5px 16px rgba(15,23,42,0.16), 0 1px 4px rgba(15,23,42,0.13)", fontSize: messageFontSize, fontWeight: 600, lineHeight: 1.45, userSelect: "none" }}>
                {renderMessage(entry)}
              </div>
            </div>
          );
        })}
      </section>

      <footer style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px calc(12px + env(safe-area-inset-bottom))", background: footerBg, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        {menuOpen && (
          <div style={{ position: "absolute", bottom: "calc(78px + env(safe-area-inset-bottom))", left: 14, width: 248, overflow: "hidden", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", zIndex: 5, animation: "menuIn 160ms ease-out", transformOrigin: "left bottom" }}>
            <button onClick={onCamera} style={menuButtonStyle}>{labels.photos || "Photos"}</button>
            <button onClick={onCamera} style={menuButtonStyle}>{labels.video || "Video"}</button>
            <button onClick={onPlusClick} style={{ ...menuButtonStyle, borderBottom: "none" }}>{labels.quickReplies || "Quick Replies"}</button>
          </div>
        )}

        <button onClick={onPlusClick} aria-label="Open menu" style={{ width: 58, height: 58, borderRadius: "50%", border: "none", background: menuOpen ? "#075e54" : "#ddd", color: menuOpen ? "#fff" : "#111", fontSize: 34, lineHeight: 1, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {menuOpen ? "×" : "+"}
        </button>

        <input value={message} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) onSend(); }} placeholder={labels.messagePlaceholder || "Message"} style={{ minWidth: 0, flex: 1, height: 58, border: "none", outline: "none", borderRadius: 29, background: inputPanelBg, color: textPrimary, padding: "0 20px", fontSize: messageFontSize }} />

        <button onClick={onSend} aria-label="Send" style={{ ...roundButtonStyle, background: "#eef6ff", color: "#0b4ea2", fontSize: 22 }}>➤</button>
        <button onClick={onCamera} aria-label="Camera" style={{ ...roundButtonStyle, background: "#eef6ff", color: "#0b4ea2", fontSize: 26 }}>📷</button>
        <button onClick={onMic} aria-label="Record audio" style={{ ...roundButtonStyle, background: "#eef6ff", color: "#0b4ea2", fontSize: 26 }}>🎤</button>
      </footer>

      {quickRepliesOpen && onQuickReply && (
        <div style={{ position: "fixed", left: 10, right: 10, bottom: 92, zIndex: 20, pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            {quickReplies.map((reply, index) => (
              <button key={`${reply}-${index}`} onClick={() => onQuickReply(reply)} style={{ width: "fit-content", maxWidth: "calc(100vw - 20px)", border: "1px solid rgba(0,0,0,0.10)", background: "#fff", color: textPrimary, borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.16)", pointerEvents: "auto" }}>{reply}</button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
