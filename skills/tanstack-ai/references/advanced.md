# Advanced Features

## Table of Contents
- [Structured Outputs](#structured-outputs)
- [Multimodal Content](#multimodal-content)
- [Runtime Adapter Switching](#runtime-adapter-switching)
- [Custom/Extended Adapters](#customextended-adapters)
- [Per-Model Type Safety](#per-model-type-safety)
- [Streaming Protocol](#streaming-protocol)

## Structured Outputs

Constrain AI responses to a JSON schema. Return type changes from `AsyncIterable<StreamChunk>` to `Promise<T>`:

```typescript
import { chat } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { z } from "zod";

const PersonSchema = z.object({
  name: z.string().describe("Full name"),
  age: z.number().describe("Age in years"),
  email: z.string().email(),
});

// Returns typed result — not a stream
const person = await chat({
  adapter: openaiText("gpt-5.2"),
  messages: [{ role: "user", content: "Extract: John Doe, 30, john@example.com" }],
  outputSchema: PersonSchema,
});
// person: { name: string, age: number, email: string }
```

Works with tools — runs agentic loop first, then generates structured output:

```typescript
const result = await chat({
  adapter: openaiText("gpt-5.2"),
  messages,
  tools: [getProductPrice],
  outputSchema: RecommendationSchema,
});
```

Supports: Zod (v4.2+), ArkType, Valibot (via `@valibot/to-json-schema`), plain JSON Schema (typed as `unknown`).

## Multimodal Content

Messages accept `content` as string or `ContentPart[]`:

```typescript
// Image from URL
await sendMessage({
  content: [
    { type: "text", content: "What is in this image?" },
    { type: "image", source: { type: "url", value: "https://example.com/photo.jpg" } },
  ],
});

// Image from base64 (mimeType required for data sources)
{ type: "image", source: { type: "data", value: base64String, mimeType: "image/jpeg" } }

// Document (PDF)
{ type: "document", source: { type: "data", value: pdfBase64, mimeType: "application/pdf" } }

// Audio
{ type: "audio", source: { type: "data", value: audioBase64, mimeType: "audio/mp3" } }
```

Content types: `TextPart`, `ImagePart`, `AudioPart`, `VideoPart`, `DocumentPart`

### React file upload example

```tsx
function ChatWithFileUpload() {
  const { sendMessage } = useChat({
    connection: fetchServerSentEvents("/api/chat"),
  });

  const handleFile = async (file: File) => {
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(file);
    });

    const type = file.type.startsWith("image/") ? "image"
      : file.type.startsWith("audio/") ? "audio"
      : file.type.startsWith("video/") ? "video"
      : "document";

    await sendMessage({
      content: [
        { type: "text", content: `Analyze this ${type}` },
        { type, source: { type: "data", value: base64, mimeType: file.type } },
      ],
    });
  };

  return <input type="file" accept="image/*,audio/*,.pdf" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />;
}
```

### Type-safe multimodal messages (server)

```typescript
import { chat, assertMessages } from "@tanstack/ai";

const { messages: incoming } = await request.json();
const typedMessages = assertMessages({ adapter }, incoming); // type-level assertion only
```

### Provider support

| Provider | Modalities |
|----------|-----------|
| OpenAI (gpt-5.2) | text, image |
| Anthropic (Claude 3.5) | text, image, document (PDF) |
| Gemini (2.0) | text, image, audio, video, document |
| Ollama | text, image (model-dependent) |

## Runtime Adapter Switching

Switch adapters at runtime using an adapter map:

```typescript
const adapters = {
  openai: () => openaiText("gpt-5.2"),
  anthropic: () => anthropicText("claude-sonnet-4-5"),
  gemini: () => geminiText("gemini-2.5-pro"),
};

export async function POST(request: Request) {
  const { messages, provider = "openai" } = await request.json();
  const stream = chat({
    adapter: adapters[provider](),
    messages,
  });
  return toServerSentEventsResponse(stream);
}
```

## Custom/Extended Adapters

Use `extendAdapter()` + `createModel()` for fine-tuned or custom models:

```typescript
import { extendAdapter, createModel } from "@tanstack/ai-openai";

const myAdapter = extendAdapter({
  models: {
    "my-fine-tuned-model": createModel({ contextWindow: 128000 }),
  },
});

const adapter = myAdapter.text("my-fine-tuned-model");
```

## Per-Model Type Safety

`modelOptions` is typed per adapter+model combination:

```typescript
const stream = chat({
  adapter: openaiText("gpt-5.2"),
  messages,
  modelOptions: {
    temperature: 0.7,    // typed for OpenAI
    maxTokens: 1000,
  },
});
```

## Streaming Protocol

Implements AG-UI Protocol. Events:

- `RUN_STARTED` — run begins
- `TEXT_MESSAGE_START` / `TEXT_MESSAGE_CONTENT` / `TEXT_MESSAGE_END` — text lifecycle
- `TOOL_CALL_START` / `TOOL_CALL_ARGS` / `TOOL_CALL_END` — tool lifecycle
- `STEP_STARTED` / `STEP_FINISHED` — thinking/reasoning steps
- `RUN_FINISHED` — completion with finish reason and usage
- `RUN_ERROR` — error

SSE format: `data: {json}\n\n`, ends with `data: [DONE]\n\n`

Monitor stream:

```typescript
const { messages } = useChat({
  connection: fetchServerSentEvents("/api/chat"),
  onChunk: (chunk) => console.log("Chunk:", chunk),
  onFinish: (message) => console.log("Done:", message),
});
```
