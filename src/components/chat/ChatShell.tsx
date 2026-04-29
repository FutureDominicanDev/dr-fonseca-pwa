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
  onVideo?: () => void;
  onCall?: () => void;
  onPlusClick: () => void;
  mode: "patient" | "staff";
  menuOpen?: boolean;
  onQuickReply?: (reply: string) => void;
  quickRepliesOpen?: boolean;
  quickReplies?: string[];
  labels?: ChatShellLabels;
  onPhotos?: () => void;
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
  onVideo,
  onCall,
  onPlusClick,
  mode,
  menuOpen = false,
  onQuickReply,
  quickRepliesOpen = false,
  quickReplies = [],
  labels = {},
}: ChatShellProps) {
  const textPrimary = "#111";
  const inputPanelBg = "#fff";

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
    <div className="flex flex-col h-screen w-full bg-gray-100">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((entry) => {
          const outgoing = mode === "staff" ? entry.sender_type === "staff" : entry.sender_type !== "staff";
          const bubbleBg = outgoing ? "#fff" : "#d9ecf7";
          return (
            <div
              key={entry.id}
              className={`flex ${outgoing ? "justify-end" : "justify-start"}`}
            >
              <div
                style={{
                  maxWidth: "70%",
                  background: bubbleBg,
                  color: textPrimary,
                  borderRadius: outgoing ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                  padding: "11px 13px",
                  boxShadow: "0 5px 16px rgba(15,23,42,0.16), 0 1px 4px rgba(15,23,42,0.13)",
                  fontSize: 16,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  userSelect: "none",
                }}
              >
                {renderMessage(entry)}
              </div>
            </div>
          );
        })}
      </div>

      {menuOpen ? (
        <div className="px-3 pb-2">
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
            <button onClick={onCamera} className="w-full px-4 py-3 text-left text-sm font-extrabold text-gray-900 border-b border-black/10">
              {labels.photos || "Photos"}
            </button>
            <button onClick={onVideo} className="w-full px-4 py-3 text-left text-sm font-extrabold text-gray-900 border-b border-black/10">
              {labels.video || "Video"}
            </button>
            <button onClick={onPlusClick} className="w-full px-4 py-3 text-left text-sm font-extrabold text-gray-900">
              {labels.quickReplies || "Quick Replies"}
            </button>
          </div>
        </div>
      ) : null}

      {quickRepliesOpen && onQuickReply ? (
        <div className="px-3 pb-2">
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {quickReplies.map((reply, index) => (
              <button key={`${reply}-${index}`} onClick={() => onQuickReply(reply)} className="self-start rounded-xl border border-black/10 bg-white px-4 py-3 text-left text-sm font-medium shadow-sm">
                {reply}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="p-3 bg-white border-t flex items-center gap-2">
        <button onClick={onPlusClick} aria-label="Open menu" className="h-12 w-12 shrink-0 rounded-full bg-gray-300 text-2xl font-semibold text-gray-900">
          {"+"}
        </button>

        <input
          value={message}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={labels.messagePlaceholder || "Message"}
          className="h-12 flex-1 rounded-full border border-transparent px-4"
          style={{ background: inputPanelBg, color: textPrimary }}
        />

        <button onClick={onSend} aria-label="Send" className="h-12 w-12 shrink-0 rounded-full bg-blue-50 text-blue-800 text-xl">
          ➤
        </button>
        <button onClick={onCamera} aria-label="Camera" className="h-12 w-12 shrink-0 rounded-full bg-blue-50 text-blue-800 text-xl">
          📷
        </button>
        <button onClick={onMic} aria-label="Record audio" className="h-12 w-12 shrink-0 rounded-full bg-blue-50 text-blue-800 text-xl">
          🎤
        </button>
        <button onClick={onCall} aria-label="Call" className="h-12 w-12 shrink-0 rounded-full bg-blue-50 text-blue-800 text-xl">
          ☎
        </button>
      </div>
    </div>
  );
}
