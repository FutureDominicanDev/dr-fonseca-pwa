"use client";
import React from "react";

type ChatMessage = {
  content: string;
  isMine?: boolean;
};

type ChatShellProps = {
  mode: "patient" | "staff";
  messages?: ChatMessage[];
  message?: string;
  onChange?: (value: string) => void;
  onSend?: () => void;
  onMic?: () => void;
  onCamera?: () => void;
  onVideo?: () => void;
  onPlusClick?: () => void;
  onCall?: () => void;
  menuOpen?: boolean;
};

export default function ChatShell({
  mode: _mode,
  messages = [],
  message = "",
  onChange,
  onSend,
  onMic,
  onCamera,
  onVideo,
  onPlusClick,
  onCall,
  menuOpen = false,
}: ChatShellProps) {
  void _mode;

  return (
    <div className="flex flex-col h-screen w-full bg-gray-100">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[70%] p-3 rounded-xl shadow ${m.isMine ? "ml-auto bg-white" : "mr-auto bg-blue-100"}`}
          >
            {m.content}
          </div>
        ))}
      </div>

      {menuOpen && (
        <div className="p-3 bg-white border-t flex gap-3">
          <button onClick={() => onCamera && onCamera()}>Photo</button>
          <button onClick={() => onVideo && onVideo()}>Video</button>
        </div>
      )}

      <div className="flex items-center gap-2 p-3 bg-white border-t">
        <button onClick={() => onPlusClick && onPlusClick()}>+</button>
        <input
          value={message}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="flex-1 px-4 py-2 rounded-full bg-gray-100"
          placeholder="Message"
        />
        <button onClick={() => onSend && onSend()}>➤</button>
        <button onClick={() => onCamera && onCamera()}>📷</button>
        <button onClick={() => onMic && onMic()}>🎤</button>
        {onCall ? <button onClick={() => onCall && onCall()}>📞</button> : null}
      </div>
    </div>
  );
}
