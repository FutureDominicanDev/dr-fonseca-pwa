type SupportedUserType = "patient" | "staff";

export async function syncPushSubscription(params: {
  subscription: PushSubscriptionJSON;
  userType: SupportedUserType;
  roomId?: string;
}) {
  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "subscribe",
      subscription: params.subscription,
      userType: params.userType,
      roomId: params.roomId,
    }),
  });

  if (!response.ok) {
    let message = "Could not save the push subscription.";
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {}
    throw new Error(message);
  }

  return response.json().catch(() => ({ ok: true }));
}
