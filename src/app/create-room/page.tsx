"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CreateRoom() {
  const [roomName, setRoomName] = useState("");
  const [office, setOffice] = useState("guadalajara");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [patientLink, setPatientLink] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    };
    checkUser();
  }, []);

  const createRoom = async () => {
    if (!userEmail) {
      setMessage("You must be logged in.");
      return;
    }

    if (!roomName) {
      setMessage("Room name required.");
      return;
    }

    // 🔥 CREATE ROOM WITH OFFICE TAG
    const { data, error } = await supabase
      .from("rooms")
      .insert([
        {
          name: roomName,
          office_location: office, // 🔥 IMPORTANT
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      setMessage("Error creating room.");
      return;
    }

    // 🔥 GENERATE PATIENT LINK
    const link = `${window.location.origin}/patient/${data.id}`;

    setPatientLink(link);
    setMessage("Room created successfully.");
    setRoomName("");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(patientLink);
    alert("Link copied!");
  };

  const sendWhatsApp = () => {
    const text = `Hola 👋\n\nEste es tu enlace para comunicarte con el equipo del Dr. Fonseca:\n\n${patientLink}\n\nGuárdalo en tu pantalla principal 📲`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-4">
        Create Patient Room
      </h1>

      <p className="mb-4 text-sm text-gray-600">
        Logged in as: {userEmail ?? "Not logged in"}
      </p>

      <input
        type="text"
        placeholder="Patient name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        className="border p-2 rounded mb-4 w-64"
      />

      {/* 🔥 OFFICE SELECT */}
      <select
        value={office}
        onChange={(e) => setOffice(e.target.value)}
        className="border p-2 rounded mb-4 w-64"
      >
        <option value="guadalajara">Guadalajara</option>
        <option value="tijuana">Tijuana</option>
      </select>

      <button
        onClick={createRoom}
        className="px-6 py-2 bg-black text-white rounded mb-4"
      >
        Create Room
      </button>

      {patientLink && (
        <div className="mt-4 text-center">
          <p className="mb-2 font-semibold">Patient Link:</p>

          <div className="text-sm break-all mb-2">
            {patientLink}
          </div>

          <button
            onClick={copyLink}
            className="px-4 py-2 bg-gray-200 rounded mr-2"
          >
            Copy Link
          </button>

          <button
            onClick={sendWhatsApp}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Send via WhatsApp
          </button>
        </div>
      )}

      {message && <p className="mt-4">{message}</p>}
    </main>
  );
}