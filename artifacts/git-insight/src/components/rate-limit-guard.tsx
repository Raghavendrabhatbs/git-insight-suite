import { useEffect, useState, useCallback } from "react";
import { Clock, Key, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RateStatus {
  remaining: number;
  limit: number;
  resetAt: string | null;
  hasToken: boolean;
}

export function useRateStatus() {
  const [status, setStatus] = useState<RateStatus | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/github/rate-status");
      const data: RateStatus = await r.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  const isLimited = !checking && status !== null && status.remaining < 5;

  return { status, checking, isLimited, recheck: check };
}

function useCountdown(resetAt: string | null) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!resetAt) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [resetAt]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return { seconds, label: `${m}:${String(s).padStart(2, "0")}` };
}

interface RateLimitScreenProps {
  resetAt: string | null;
  onBack: () => void;
  onRetry: () => void;
}

export function RateLimitScreen({ resetAt, onBack, onRetry }: RateLimitScreenProps) {
  const { seconds, label } = useCountdown(resetAt);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <Clock className="w-9 h-9 text-amber-400" />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-2 text-foreground">GitHub Rate Limit Reached</h2>
        <p className="text-muted-foreground max-w-xs">
          GitHub allows 60 free API requests per hour. This quota has been used up.
        </p>
      </div>

      {resetAt && seconds > 0 ? (
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Resets in</p>
          <div className="text-5xl font-bold font-mono text-amber-400 tabular-nums">{label}</div>
          <p className="text-xs text-muted-foreground mt-1">
            at {new Date(resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      ) : (
        <Button onClick={onRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Rate limit reset — Try again
        </Button>
      )}

      <div className="p-5 rounded-2xl bg-violet-500/10 border border-violet-500/20 max-w-sm w-full text-left">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">Skip the wait — add a GitHub Token</span>
        </div>
        <ol className="text-xs text-zinc-400 space-y-1.5 list-decimal list-inside">
          <li>
            Go to{" "}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-violet-400 underline">
              github.com/settings/tokens
            </a>
          </li>
          <li>Generate new token (classic)</li>
          <li>
            Select <code className="bg-white/10 px-1 rounded">public_repo</code> scope
          </li>
          <li>
            Add it as <code className="bg-white/10 px-1 rounded">GITHUB_TOKEN</code> in Replit Secrets
          </li>
        </ol>
        <p className="text-xs text-zinc-500 mt-3">Raises limit from 60 → 5,000 requests/hour</p>
      </div>

      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        ← Go back
      </Button>
    </div>
  );
}
