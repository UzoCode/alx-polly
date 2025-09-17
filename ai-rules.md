# AI Rule File for Polling App (ai-rules.md)

1. Authorization first: Any action that mutates database state must verify the authenticated user is authorized (owner or admin) before changing rows.
2. Explicit select: DB queries must select only required fields (avoid `select("*")`) to limit accidental data leakage.
3. Typed returns: All exported actions must return a typed result object `{ error: string | null, data?: T }` for consistent client handling.
4. UI reflects state: Client UI must disable or hide actions that are not allowed by the resource's state (e.g., voting disabled when poll.status === "closed").
