const inTauri = "__TAURI_INTERNALS__" in window;

// ─ Knowledge Hub ───────────────────────────

export async function writeNoteToVault(vaultPath: string, fileName: string, content: string): Promise<string> {
  if (inTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("write_note", { vaultPath, fileName, content });
  }
  // Browser fallback: write to localStorage for demo
  console.warn("Not in Tauri — note saved to memory only");
  localStorage.setItem(`note:${vaultPath}/${fileName}`, content);
  return `Saved to ${vaultPath}/${fileName} (browser fallback)`;
}

export async function loadVaultNotes(vaultPath: string): Promise<any[]> {
  if (inTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const json = await invoke<string>("read_vault_notes", { vaultPath });
    return JSON.parse(json);
  }
  // Browser fallback: empty
  return [];
}

// ─ Chat ─────────────────────────────────────

async function ollamaFetch(messagesJson: string, modelName: string): Promise<string> {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages: JSON.parse(messagesJson),
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.message?.content ?? "(empty)";
}

export async function sendChat(
  model: string,
  messagesJson: string,
  ollamaModel: string
): Promise<string> {
  if (inTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("send_chat_message", { model, messagesJson, ollamaModel });
  }
  if (model === "ollama") return ollamaFetch(messagesJson, ollamaModel);
  if (model === "cloud") {
    const key = prompt("Enter your OpenAI API key:");
    if (!key) throw new Error("API key required");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: JSON.parse(messagesJson) }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.choices[0].message?.content ?? "(empty)";
  }
  if (model === "codex") {
    const msgs = JSON.parse(messagesJson);
    const last = msgs[msgs.length - 1]?.content ?? "";
    return `[Codex CLI 浏览器不可用]\nPrompt: ${last}\n\n请用 npm run tauri dev 启动桌面版。`;
  }
  if (model === "auto") {
    try {
      const key = prompt("Enter your OpenAI API key:");
      if (!key) throw new Error("API key required");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: JSON.parse(messagesJson) }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      const json = await res.json();
      return json.choices[0].message?.content ?? "(empty)";
    } catch {
      return ollamaFetch(messagesJson, ollamaModel);
    }
  }
  throw new Error(`Unknown model: ${model}`);
}

export async function runCodex(
  idea: string,
  clarificationsJson: string
): Promise<string> {
  if (inTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("run_codex", { idea, clarificationsJson });
  }
  return `[Codex CLI 浏览器不可用]\nIdea: ${idea}\n\n请用 npm run tauri dev 启动桌面版。`;
}
