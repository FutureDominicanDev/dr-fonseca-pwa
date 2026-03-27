"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PatientsPage() {

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const createPatient = async () => {

    if (!name) {
      setMessage("Patient name required.");
      return;
    }

    const { error } = await supabase
      .from("patients")
      .insert([
        {
          full_name: name,
          phone: phone,
          email: email
        }
      ]);

    if (error) {
      console.error(error);
      setMessage("Error creating patient.");
    } else {
      setMessage("Patient created successfully.");
      setName("");
      setPhone("");
      setEmail("");
    }
  };

  return (

    <main className="min-h-screen flex flex-col items-center justify-center p-6">

      <h1 className="text-3xl font-bold mb-6">
        Crear Paciente / Create Patient
      </h1>

      <input
        type="text"
        placeholder="Nombre del paciente"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border p-2 rounded mb-3 w-80"
      />

      <input
        type="text"
        placeholder="Teléfono"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="border p-2 rounded mb-3 w-80"
      />

      <input
        type="text"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 rounded mb-3 w-80"
      />

      <button
        onClick={createPatient}
        className="px-6 py-2 bg-black text-white rounded"
      >
        Crear Paciente
      </button>

      {message && (
        <p className="mt-4">{message}</p>
      )}

    </main>

  );
}