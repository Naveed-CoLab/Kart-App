"use client";
import { useRef, useState } from "react";
import { ArrowUp, Paperclip, ShieldCheck, Square, X } from "lucide-react";
import { useApp, usd0 } from "./app-context";

/** Downscale photos client-side so uploads stay small. */
async function toDataUrl(file: File): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.85);
}

export default function Composer({
  onSend,
  disabled,
  placeholder = "Ask Kart to find or buy something…",
  big = false,
  autoFocus = false,
  onStop,
}: {
  onSend: (text: string, image: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  big?: boolean;
  autoFocus?: boolean;
  /** When set, the send button becomes a stop button (while Kart is answering). */
  onStop?: () => void;
}) {
  const { rules, setRulesOpen } = useApp();
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    if (disabled || (!text.trim() && !image)) return;
    onSend(text.trim(), image);
    setText("");
    setImage(null);
    if (taRef.current) taRef.current.style.height = "auto";
  };
  const canSend = !disabled && (!!text.trim() || !!image);
  return (
    <div
      className={`w-full rounded-2xl border bg-surface transition ${focus ? "border-action/50 shadow-[0_0_0_4px_rgba(0,112,224,0.08),var(--shadow-pop)]" : "border-line shadow-[0_2px_12px_-4px_rgba(11,27,51,0.08)]"} ${big ? "p-3.5" : "p-2.5"}`}
    >
      {image && (
        <div className="relative mb-2 ml-1 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="attachment" className="h-16 w-16 rounded-xl border border-line object-cover" />
          <button aria-label="Remove photo" className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white" onClick={() => setImage(null)}>
            <X size={11} />
          </button>
        </div>
      )}
      <textarea
        ref={taRef}
        autoFocus={autoFocus}
        rows={big ? 2 : 1}
        value={text}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => {
          setText(e.target.value);
          const el = e.target;
          el.style.height = "auto";
          el.style.height = Math.min(el.scrollHeight, 200) + "px";
          el.style.overflowY = el.scrollHeight > 200 ? "auto" : "hidden";
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        style={{ overflowY: "hidden" }}
        className={`block w-full resize-none bg-transparent px-2 py-1 leading-[1.5] outline-none placeholder:text-subtle focus-visible:outline-none ${big ? "min-h-[56px] text-[16px]" : "min-h-[32px] text-[15px]"}`}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => fileRef.current?.click()} title="Attach a photo" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted transition hover:bg-sunken hover:text-ink">
            <Paperclip size={15} />
            <span className="hidden sm:inline">Photo</span>
          </button>
          {rules && (
            <button type="button" onClick={() => setRulesOpen(true)} title="Your spending rules" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-2.5 text-[12.5px] text-muted transition hover:border-line-strong hover:text-ink">
              <ShieldCheck size={14} className="text-success" />
              <span className="tabular-nums">
                Auto ≤ {usd0(rules.autoBuyUnder)} · Max {usd0(rules.perItemMax)}
              </span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setImage(await toDataUrl(f));
            e.target.value = "";
          }}
        />
        {onStop ? (
          <button aria-label="Stop" title="Stop" onClick={onStop} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white transition hover:bg-[#13284a]">
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button aria-label="Send" title="Send (Enter). New line: Shift+Enter" onClick={submit} disabled={!canSend} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${canSend ? "bg-action text-white hover:bg-action-hover" : "bg-sunken text-subtle"}`}>
            <ArrowUp size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
