export type AuditEntry = {
  id: string;
  at: string;
  action: string;
  details: Record<string, unknown>;
};
const actions: Record<string, string> = {
  "task.created": "Review task created",
  "task.updated": "Review task updated",
  "intervention.created": "Intervention recorded",
  "import.preview": "Import validated",
  "import.committed": "Import completed",
  "settings.changed": "Workspace settings changed",
};
export function AuditTrail({ entries }: { entries: AuditEntry[] | null }) {
  if (entries === null)
    return (
      <p className="audit-message">
        Load the audit trail to review recorded workspace changes.
      </p>
    );
  if (!entries.length)
    return (
      <p className="audit-message" role="status">
        No changes recorded in this workspace.
      </p>
    );
  return (
    <div className="audit-trail">
      <p className="small muted">
        {entries.length} loaded entries · newest first · times in UTC · up to
        100 entries per load
      </p>
      <ol>
        {[...entries]
          .sort((a, b) => b.at.localeCompare(a.at))
          .map((entry) => (
            <li key={entry.id}>
              <strong>
                {actions[entry.action] ?? entry.action.replaceAll(".", " ")}
              </strong>
              <time dateTime={entry.at}>
                {new Date(entry.at).toLocaleString("en-GB", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
              <details>
                <summary>Recorded details</summary>
                <pre>{JSON.stringify(entry.details, null, 2)}</pre>
              </details>
            </li>
          ))}
      </ol>
    </div>
  );
}
