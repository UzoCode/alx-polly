"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Return type standard:
 * { error: string | null, data?: any }
 */

/* ---------- Validation Schemas ---------- */
const CreateUpdatePollSchema = z.object({
  question: z.string().min(5, "Question is too short").max(1000),
  options: z
    .array(z.string().min(1).max(300))
    .min(2, "At least two options are required")
    .max(50),
});

const SubmitVoteSchema = z.object({
  pollId: z.string().uuid(),
  optionIndex: z.number().int().nonnegative(),
});

/* ---------- Helpers ---------- */
async function getAuthenticatedUser(supabase: ReturnType<typeof createClient> extends Promise<any> ? any : any) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error("Failed to read user session: " + error.message);
  if (!data?.user) return null;
  return data.user;
}

/* ---------- CREATE POLL ---------- */
export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  // Parse and validate incoming fields
  const question = (formData.get("question") as string) ?? "";
  const optionsRaw = formData.getAll("options").filter(Boolean) as string[];
  // Trim/normalize options and remove empty ones
  const options = optionsRaw.map((o) => String(o).trim()).filter(Boolean);

  const parsed = CreateUpdatePollSchema.safeParse({ question, options });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  // Auth check
  let user;
  try {
    user = await getAuthenticatedUser(supabase);
  } catch (err: any) {
    return { error: "Unable to verify session." };
  }
  if (!user) {
    return { error: "You must be logged in to create a poll." };
  }

  // Insert poll (only required fields) and link to user
  const { error } = await supabase.from("polls").insert([
    {
      user_id: user.id,
      question: parsed.data.question,
      options: parsed.data.options,
    },
  ]);

  if (error) {
    return { error: error.message };
  }

  // Invalidate cache for polls listing
  revalidatePath("/polls");
  return { error: null };
}

/* ---------- GET USER POLLS ---------- */
export async function getUserPolls() {
  const supabase = await createClient();

  let user;
  try {
    user = await getAuthenticatedUser(supabase);
  } catch {
    return { polls: [], error: "Failed to read session" };
  }
  if (!user) return { polls: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("polls")
    .select("id, question, options, created_at, user_id") // 👈 added user_id
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { polls: [], error: error.message };
  return { polls: data ?? [], error: null };
}

/* ---------- GET POLL BY ID ---------- */
export async function getPollById(id: string) {
  // Validate id as UUID if your DB uses UUIDs; fallback to basic check
  if (!id || typeof id !== "string") return { poll: null, error: "Invalid poll id" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("polls")
    // Select only necessary fields (avoid leaking internal data)
    .select("id, question, options, user_id, created_at")
    .eq("id", id)
    .single();

  if (error) return { poll: null, error: error.message };
  return { poll: data, error: null };
}

/* ---------- SUBMIT VOTE ---------- */
export async function submitVote(pollIdRaw: string, optionIndexRaw: number) {
  // Validate input
  const parsed = SubmitVoteSchema.safeParse({ pollId: pollIdRaw, optionIndex: optionIndexRaw });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const { pollId, optionIndex } = parsed.data;

  const supabase = await createClient();

  // Enforce login to vote (safer). If anonymous votes are desired, change policy.
  let user;
  try {
    user = await getAuthenticatedUser(supabase);
  } catch {
    return { error: "Failed to verify session." };
  }
  if (!user) {
    return { error: "You must be logged in to vote." };
  }

  // Ensure poll exists and optionIndex is valid
  const { data: poll, error: pollErr } = await supabase
    .from("polls")
    .select("id, options")
    .eq("id", pollId)
    .single();
  if (pollErr) return { error: "Poll not found." };

  const options = poll.options ?? [];
  if (optionIndex < 0 || optionIndex >= options.length) {
    return { error: "Invalid option selected." };
  }

  // Use upsert to enforce one vote per user (requires unique constraint on (poll_id, user_id))
  const payload = {
    poll_id: pollId,
    user_id: user.id,
    option_index: optionIndex,
    created_at: new Date().toISOString(),
  };

  // Attempt upsert (update if exists, insert otherwise). This requires DB unique constraint.
  const { error } = await supabase
    .from("votes")
    .upsert(payload, { onConflict: ["poll_id", "user_id"] })
    .select();

  if (error) {
    // If upsert fails due to constraint or other DB issue, return a clear message
    return { error: error.message };
  }

  // Optionally revalidate poll page to update results
  revalidatePath(`/polls/${pollId}`);
  return { error: null };
}

/* ---------- CAST A VOTE ---------- */
export async function castVote(
  poll_id: string,
  user_id: string,
  option_index: number
) {
  if (!poll_id || !user_id) {
    return { success: false, error: "Missing poll_id or user_id" };
  }

  const supabase = await createClient();

  const payload = [
    {
      poll_id,
      user_id,
      option_index,
      created_at: new Date().toISOString(),
    },
  ];

  const { data, error } = await supabase
    .from("votes")
    .upsert(payload, { onConflict: "poll_id,user_id" }) // ✅ Correct syntax
    .select();

  if (error) {
    console.error("Vote upsert failed:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/* ---------- DELETE POLL ---------- */
export async function deletePoll(id: string) {
  if (!id) return { error: "Invalid poll id" };
  const supabase = await createClient();

  // Get current user
  let user;
  try {
    user = await getAuthenticatedUser(supabase);
  } catch {
    return { error: "Failed to verify session." };
  }
  if (!user) return { error: "Not authenticated" };

  // Verify ownership before deleting
  const { data: existing, error: findErr } = await supabase
    .from("polls")
    .select("user_id")
    .eq("id", id)
    .single();
  if (findErr) return { error: findErr.message };
  if (existing.user_id !== user.id) return { error: "Forbidden: you do not own this poll." };

  // Delete poll (cascading votes if DB configured)
  const { error } = await supabase.from("polls").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/polls");
  return { error: null };
}

/* ---------- UPDATE POLL ---------- */
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  // Validate input
  const question = (formData.get("question") as string) ?? "";
  const optionsRaw = formData.getAll("options").filter(Boolean) as string[];
  const options = optionsRaw.map((o) => String(o).trim()).filter(Boolean);

  const parsed = CreateUpdatePollSchema.safeParse({ question, options });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  // Auth check
  let user;
  try {
    user = await getAuthenticatedUser(supabase);
  } catch {
    return { error: "Unable to verify session." };
  }
  if (!user) return { error: "You must be logged in to update a poll." };

  // Verify ownership
  const { data: existing, error: findErr } = await supabase
    .from("polls")
    .select("user_id")
    .eq("id", pollId)
    .single();
  if (findErr) return { error: findErr.message };
  if (existing.user_id !== user.id) return { error: "Forbidden: you do not own this poll." };

  // Update poll
  const { error } = await supabase.from("polls").update({
    question: parsed.data.question,
    options: parsed.data.options,
  }).eq("id", pollId);

  if (error) return { error: error.message };
  revalidatePath(`/polls/${pollId}`);
  return { error: null };
}
