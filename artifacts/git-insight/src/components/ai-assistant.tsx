import { useEffect, useRef, useState } from "react";
import { useRepoChat } from "@workspace/api-client-react";
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiAssistantProps {
  owner: string;
  repo: string;
}

const SUGGESTED = [
  "What does this repo do?",
  "What tech stack is used?",
  "Who are the top contributors?",
  "What are the recent changes?",
  "How do I set up this project?",
  "Explain the folder structure",
];

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </span>
  );
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const output: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      output.push(
        <pre
          key={i}
          className="bg-black/40 border border-white/10 rounded-lg p-3 my-2 overflow-x-auto"
        >
          {lang && (
            <div className="text-[9px] text-muted-foreground/60 uppercase mb-1 font-mono">
              {lang}
            </div>
          )}
          <code className="text-[11px] font-mono text-green-300 leading-relaxed whitespace-pre">
            {codeLines.join("\n")}
          </code>
        </pre>,
      );
      i++;
      continue;
    }

    if (/^#{1,3} /.test(line)) {
      const level = (line.match(/^#+/) ?? [""])[0].length;
      const content = line.replace(/^#+\s/, "");
      const cls =
        level === 1
          ? "text-sm font-bold text-foreground mt-2 mb-1"
          : level === 2
            ? "text-xs font-bold text-foreground mt-2 mb-0.5"
            : "text-xs font-semibold text-muted-foreground mt-1.5 mb-0.5";
      output.push(
        <div key={i} className={cls}>
          {inlineMarkdown(content)}
        </div>,
      );
      i++;
      continue;
    }

    if (/^(\s*[-*+] )/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*[-*+] )/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+] /, ""));
        i++;
      }
      output.push(
        <ul key={i} className="my-1 space-y-0.5 pl-3">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5 text-xs leading-relaxed">
              <span className="text-violet-400 shrink-0 mt-0.5">•</span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      let n = 1;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
        n++;
      }
      output.push(
        <ol key={i} className="my-1 space-y-0.5 pl-3">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5 text-xs leading-relaxed">
              <span className="text-violet-400 shrink-0 font-mono text-[10px] mt-0.5">
                {j + 1}.
              </span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (line.trim() === "" || line.trim() === "---") {
      output.push(<div key={i} className="h-1" />);
      i++;
      continue;
    }

    output.push(
      <p key={i} className="text-xs leading-relaxed">
        {inlineMarkdown(line)}
      </p>,
    );
    i++;
  }

  return <div className="space-y-0.5">{output}</div>;
}

function inlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={i} className="italic text-foreground/80">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="bg-white/10 text-violet-300 px-1 py-0.5 rounded text-[10px] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function AiAssistant({ owner, repo }: AiAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { mutate: sendMessage, isPending } = useRepoChat();

  const welcomeMsg = `Hi! I'm your AI assistant for **${owner}/${repo}**. I have deep context about this repo — README, commits, contributors, file structure, and more. Ask me **anything**: repo-specific questions, general coding topics, architecture advice, or anything else!`;

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
      if (messages.length === 0) {
        setMessages([{ role: "assistant", content: welcomeMsg }]);
      }
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isPending) return;

    const userMsg: Message = { role: "user", content: msg };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const history = nextMessages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    sendMessage(
      { data: { owner, repo, message: msg, history } },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.response },
          ]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "Sorry, something went wrong. Please try again.",
            },
          ]);
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", content: welcomeMsg }]);
  };

  const showSuggestions = messages.length <= 1 && !isPending;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 ${
          open
            ? "bg-violet-600 hover:bg-violet-700"
            : "bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600"
        }`}
        title="AI Assistant"
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageSquare className="w-6 h-6 text-white" />
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-background" />
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[430px] max-h-[660px] flex flex-col rounded-2xl border border-violet-500/30 bg-[#0a0a12] shadow-2xl shadow-violet-900/40 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-violet-500/20 bg-gradient-to-r from-violet-900/50 to-purple-900/30 shrink-0">
            <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">AI Assistant</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                  Online
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {owner}/{repo} · Ask me anything
              </p>
            </div>
            <button
              onClick={clearChat}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0 max-h-[500px]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                    msg.role === "user"
                      ? "bg-violet-600/50"
                      : "bg-purple-700/40 border border-purple-500/30"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-3 h-3 text-violet-200" />
                  ) : (
                    <Bot className="w-3 h-3 text-purple-300" />
                  )}
                </div>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl ${
                    msg.role === "user"
                      ? "bg-violet-600/20 border border-violet-500/25 text-foreground"
                      : "bg-white/5 border border-white/8 text-foreground/90"
                  }`}
                >
                  {renderMarkdown(msg.content)}
                </div>
              </div>
            ))}

            {showSuggestions && (
              <div className="pt-1">
                <p className="text-[10px] text-muted-foreground/70 mb-2 px-1">Suggested questions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isPending && (
              <div className="flex gap-2 flex-row">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 bg-purple-700/40 border border-purple-500/30">
                  <Bot className="w-3 h-3 text-purple-300" />
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 flex items-center gap-1">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-2.5 border-t border-white/8 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="flex-1 resize-none text-xs bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors leading-relaxed"
                style={{ minHeight: "38px", maxHeight: "120px" }}
                disabled={isPending}
              />
              <Button
                size="icon"
                className="h-9 w-9 bg-violet-600 hover:bg-violet-700 flex-shrink-0 rounded-xl"
                onClick={() => handleSend()}
                disabled={!input.trim() || isPending}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground/40 mt-1.5 text-center">
              AI · Repo context · General knowledge
            </p>
          </div>
        </div>
      )}
    </>
  );
}
