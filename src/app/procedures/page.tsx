"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProceduresPage() {

  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [procedureName, setProcedureName] = useState("");
  const [office, setOffice] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    const { data } = await supabase
      .from("patients")
      .select("*");

    if (data) setPatients(data);
  };

  const createProcedure = async () => {

    if (!selectedPatient || !procedureName) {
      setMessage("Debe seleccionar un paciente y escribir el procedimiento.");
      return;
    }

    const { data, error } = await supabase
      .from("procedures")
      .insert([
        {
          patient_id: selectedPatient,
          procedure_name: procedureName,
          office_location: office
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      setMessage("Error al crear el procedimiento.");
      return;
    }

    const procedureId = data.id;

    const user = await supabase.auth.getUser();

    const { data: roomData } = await supabase
      .from("rooms")
      .insert([
        {
          procedure_id: procedureId,
          created_by: user.data.user?.id
        }
      ])
      .select()
      .single();

    if (roomData) {

      await supabase
        .from("room_members")
        .insert([
          {
            room_id: roomData.id,
            user_id: user.data.user?.id,
            role: "doctor"
          }
        ]);

    }

    setMessage("Procedimiento y sala creados correctamente.");

    setProcedureName("");
    setOffice("");
  };

  return (

    <main className="min-h-screen flex flex-col items-center p-10">

      <h1 className="text-3xl font-bold mb-6">
        Crear Procedimiento
      </h1>

      <select
        value={selectedPatient}
        onChange={(e) => setSelectedPatient(e.target.value)}
        className="border p-2 rounded mb-4 w-80"
      >

        <option value="">Seleccionar paciente</option>

        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}

      </select>

      <input
        type="text"
        placeholder="Nombre del procedimiento"
        value={procedureName}
        onChange={(e) => setProcedureName(e.target.value)}
        className="border p-2 rounded mb-4 w-80"
      />

      <select
        value={office}
        onChange={(e) => setOffice(e.target.value)}
        className="border p-2 rounded mb-4 w-80"
      >

        <option value="">Seleccionar oficina</option>
        <option value="Guadalajara">Guadalajara</option>
        <option value="Tijuana">Tijuana</option>

      </select>

      <button
        onClick={createProcedure}
        className="bg-black text-white px-6 py-2 rounded"
      >
        Crear Procedimiento
      </button>

      {message && <p className="mt-4">{message}</p>}

    </main>

  );
}