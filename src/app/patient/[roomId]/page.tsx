"use client";
import { useEffect, useState, useRef, use } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PatientPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [patientName, setPatientName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSending = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchRoom();

    const ch = supabase.channel("patient-rt-" + roomId)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room_id=eq.${roomId}`
      }, ({ new: m }) => {
        // 🔥 BLOCK INTERNAL MESSAGES HERE
        if (m.is_internal) return;

        setMessages(prev => [...prev, m]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId]);

  const fetchRoom = async () => {
    const { data: rm, error } = await supabase
      .from("rooms")
      .select("*, procedures(procedure_name, office_location, patients(full_name))")
      .eq("id", roomId)
      .single();

    if (error || !rm) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setRoom(rm);
    setPatientName(rm.procedures?.patients?.full_name || "Paciente");

    // 🔥 THIS IS THE MAIN FIX
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_internal", false) // 🚨 BLOCK PRIVATE
      .order("created_at", { ascending: true });

    setMessages(msgs || []);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);

    await supabase.from("messages").insert({
      room_id: roomId,
      content: newMessage,
      message_type: "text",
      sender_type: "patient",
      sender_name: patientName,
      is_internal: false // 🔥 ALWAYS SAFE
    });

    setNewMessage("");
    setSending(false);
  };

  if (loading) return <div>Loading...</div>;
  if (notFound) return <div>Invalid link</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Chat</h2>

      {messages.map((m) => (
        <div key={m.id} style={{ marginBottom: 10 }}>
          {m.content}
        </div>
      ))}

      <input
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder="Mensaje..."
      />

      <button onClick={sendMessage} disabled={sending}>
        Send
      </button>
    </div>
  );
}