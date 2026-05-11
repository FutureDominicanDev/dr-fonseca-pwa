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
  const resolvedToken = `${token || ""}`.trim();
  const target = resolvedToken ? `/chat/${roomId}?token=${encodeURIComponent(resolvedToken)}` : `/chat/${roomId}`;

  redirect(target);
}
