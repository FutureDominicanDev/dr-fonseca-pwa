import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CHAT_FILES_BUCKET } from "@/lib/chatFileUrls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "missing-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const safeStorageSegment = (value: string) =>
  `${value || "file"}`
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "file";

const normalizeMediaType = (value: FormDataEntryValue | string | null | undefined) => {
  const clean = `${value || ""}`.trim().toLowerCase();
  return clean === "image" || clean === "video" || clean === "audio" || clean === "file" ? clean : "file";
};

const extensionFor = (fileName: string, mimeType: string, mediaType = "file") => {
  const fromName = /\.([a-z0-9]{2,8})$/i.exec(fileName)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const type = mimeType.toLowerCase();
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("quicktime")) return "mov";
  if (type.includes("3gpp")) return "3gp";
  if (type.includes("mp4")) return mediaType === "audio" || type.startsWith("audio/") ? "m4a" : "mp4";
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("webm")) return "webm";
  return "bin";
};

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Staff media upload is not configured." }, { status: 503 });
    }

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile?.id || `${profile.role || ""}`.toLowerCase() === "pending_staff") {
      return NextResponse.json({ error: "Staff approval is required before uploading media." }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      const action = `${body?.action || ""}`.trim();

      if (action === "createUpload") {
        const mediaType = normalizeMediaType(body?.mediaType);
        const fileType = `${body?.fileType || "application/octet-stream"}`.trim() || "application/octet-stream";
        const originalName = safeStorageSegment(`${body?.fileName || `${mediaType}-${Date.now()}`}`);
        const ext = extensionFor(originalName, fileType, mediaType);
        const fileBase = originalName.toLowerCase().endsWith(`.${ext}`) ? originalName : `${originalName}.${ext}`;
        const path = `staff-chat/${safeStorageSegment(user.id)}/${Date.now()}-${fileBase}`;
        const { data, error } = await adminClient.storage.from(CHAT_FILES_BUCKET).createSignedUploadUrl(path);
        if (error || !data?.token) throw error || new Error("Missing signed upload token.");
        return NextResponse.json({ path: data.path || path, token: data.token });
      }

      if (action === "completeUpload") {
        const path = `${body?.path || ""}`.trim();
        const expectedPrefix = `staff-chat/${safeStorageSegment(user.id)}/`;
        if (!path || path.includes("..") || !path.startsWith(expectedPrefix)) {
          return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
        }

        const { data: publicData } = adminClient.storage.from(CHAT_FILES_BUCKET).getPublicUrl(path);
        const { data: signedData } = await adminClient.storage.from(CHAT_FILES_BUCKET).createSignedUrl(path, 3600);
        return NextResponse.json({
          path,
          publicUrl: publicData.publicUrl,
          signedUrl: signedData?.signedUrl || null,
        });
      }

      return NextResponse.json({ error: "Unknown staff media action." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }
    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: "File is too large." }, { status: 413 });
    }

    const mediaType = normalizeMediaType(formData.get("mediaType"));
    const originalName = safeStorageSegment(file.name || `${mediaType}-${Date.now()}`);
    const ext = extensionFor(originalName, file.type || "application/octet-stream", mediaType);
    const fileBase = originalName.toLowerCase().endsWith(`.${ext}`) ? originalName : `${originalName}.${ext}`;
    const path = `staff-chat/${safeStorageSegment(user.id)}/${Date.now()}-${fileBase}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await adminClient.storage.from(CHAT_FILES_BUCKET).upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || "Could not upload staff media." }, { status: 500 });
    }

    const { data: publicData } = adminClient.storage.from(CHAT_FILES_BUCKET).getPublicUrl(path);
    const { data: signedData } = await adminClient.storage.from(CHAT_FILES_BUCKET).createSignedUrl(path, 3600);

    return NextResponse.json({
      path,
      publicUrl: publicData.publicUrl,
      signedUrl: signedData?.signedUrl || null,
      fileName: file.name || fileBase,
      fileSize: file.size,
      mimeType: file.type || null,
    });
  } catch (error) {
    console.error("staff media upload failed", error);
    return NextResponse.json({ error: "Staff media upload failed." }, { status: 500 });
  }
}
