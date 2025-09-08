"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/botton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { deletePoll } from "@/app/lib/actions/poll-actions";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/app/lib/context/auth-context"; // ✅ Reuse auth context

interface Poll {
  id: string;
  question: string;
  user_id: string;
  created_at: string;
  options: string[];
}

export default function AdminPage() {
  const { user } = useAuth(); // ✅ Access current user
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setError("Unauthorized: You must be logged in to view this page.");
      setLoading(false);
      return;
    }
    fetchAllPolls();
  }, [user]);

  const fetchAllPolls = async () => {
    try {
      const supabase = createClient();

      // ✅ Restrict access to admin role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user?.id)
        .single();

      if (profile?.role !== "admin") {
        setError("Access denied: Admins only.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("polls")
        .select("id, question, user_id, created_at, options")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPolls(data ?? []);
    } catch (err: any) {
      console.error("Error fetching polls:", err);
      setError("Failed to load polls. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pollId: string) => {
    try {
      setDeleteLoading(pollId);
      const result = await deletePoll(pollId);

      if (result.error) throw result.error;

      setPolls((prev) => prev.filter((poll) => poll.id !== pollId));
    } catch (err: any) {
      console.error("Delete error:", err);
      setError("Failed to delete poll.");
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading) {
    return <div className="p-6">Loading all polls...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-gray-600 mt-2">
          View and manage all polls in the system.
        </p>
      </div>

      <div className="grid gap-4">
        {polls.map((poll) => (
          <Card key={poll.id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{poll.question}</CardTitle>
                  <CardDescription>
                    <div className="space-y-1 mt-2">
                      <div>
                        Poll ID:{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {poll.id}
                        </code>
                      </div>
                      <div>
                        Created:{" "}
                        {new Date(poll.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardDescription>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(poll.id)}
                  disabled={deleteLoading === poll.id}
                >
                  {deleteLoading === poll.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h4 className="font-medium">Options:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {poll.options.map((option, index) => (
                    <li key={index} className="text-gray-700">
                      {option}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {polls.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No polls found in the system.
        </div>
      )}
    </div>
  );
}
