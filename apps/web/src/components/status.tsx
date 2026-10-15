import { AlertTriangle, CheckCircle2, Activity } from "lucide-react";
export const Status = ({ value }: { value: string }) => (
  <span
    className={
      "status " +
      (value === "investigate"
        ? "warn"
        : value === "within reference"
          ? "good"
          : "neutral")
    }
  >
    {value === "investigate" ? (
      <AlertTriangle size={13} />
    ) : value === "within reference" ? (
      <CheckCircle2 size={13} />
    ) : (
      <Activity size={13} />
    )}{" "}
    {value}
  </span>
);
