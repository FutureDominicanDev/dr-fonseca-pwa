"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CreateRoom() {
  const [roomName, setRoomName] = useState("");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check current authenticated user
  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error("Error getting user:", error);
      }

      if (data.user) {
        console.log("Current user:", data.user);
        setUserEmail(data.user.email ?? null);
      } else {
        console.log("No authenticated user found.");
        setUserEmail(null);
      }
    };

    checkUser();
  }, []);

  const createRoom = async () => {
    if (!userEmail) {
      setMessage("You must be logged in to create a room.");
      return;
    }

    if (!roomName) {
      setMessage("Room name required.");
      return;
    }

    const { data, error } = await supabase
      .from("rooms")
      .insert([{ name: roomName }]);

    if (error) {
      console.error(error);
      setMessage("Error creating room.");
    } else {
      console.log("Room created:", data);
      setMessage("Room created successfully.");
      setRoomName("");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-2">
        Create Room / Crear sala
      </h1>

      <p className="mb-4 text-sm text-gray-600">
        Logged in as: {userEmail ?? "Not logged in"}
      </p>

      <input
        type="text"
        placeholder="Enter room name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        className="border p-2 rounded mb-4 w-64"
      />

      <button
        onClick={createRoom}
        className="px-6 py-2 bg-black text-white rounded"
      >
        Create Room
      </button>

      {message && <p className="mt-4">{message}</p>}
    </main>
  );
}