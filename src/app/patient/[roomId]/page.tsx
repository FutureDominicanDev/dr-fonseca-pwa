import { redirect } from "next/navigation";

export default async function PatientRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { roomId } = await params;
  const { token } = await searchParams;
  const target = token ? `/chat/${roomId}?token=${encodeURIComponent(token)}` : `/chat/${roomId}`;

  redirect(target);
}
