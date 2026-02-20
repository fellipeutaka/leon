# Server Setup

## Next.js (App Router)

```typescript
// app/api/chat/route.ts
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";

export async function POST(request: Request) {
  const { messages, conversationId } = await request.json();

  const stream = chat({
    adapter: openaiText("gpt-5.2"),
    messages,
    conversationId,
    systemPrompts: ["You are a helpful assistant"],
  });

  return toServerSentEventsResponse(stream);
}
```

## TanStack Start

```typescript
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, conversationId } = await request.json();
        const stream = chat({
          adapter: openaiText("gpt-5.2"),
          messages,
          conversationId,
        });
        return toServerSentEventsResponse(stream);
      },
    },
  },
});
```

## With Server Tools

```typescript
import { chat, toServerSentEventsResponse, toolDefinition } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { z } from "zod";

// Tool definitions can be shared between server and client
const getUserDataDef = toolDefinition({
  name: "get_user_data",
  description: "Get user information from the database",
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ name: z.string(), email: z.string() }),
});

const getUserData = getUserDataDef.server(async ({ userId }) => {
  const user = await db.users.findUnique({ where: { id: userId } });
  return { name: user.name, email: user.email };
});

export async function POST(request: Request) {
  const { messages } = await request.json();
  const stream = chat({
    adapter: openaiText("gpt-5.2"),
    messages,
    tools: [getUserData],
  });
  return toServerSentEventsResponse(stream);
}
```

## With Client Tool Definitions (no execute on server)

Pass tool definitions (not implementations) so the LLM knows about them but execution happens on client:

```typescript
import { updateUIDef, saveToLocalStorageDef } from "@/tools/definitions";

export async function POST(request: Request) {
  const { messages } = await request.json();
  const stream = chat({
    adapter: openaiText("gpt-5.2"),
    messages,
    tools: [updateUIDef, saveToLocalStorageDef], // definitions only — client executes
  });
  return toServerSentEventsResponse(stream);
}
```

## Streaming Helpers

```typescript
import { chat, toServerSentEventsResponse, toServerSentEventsStream } from "@tanstack/ai";

// Full Response with headers (Content-Type: text/event-stream, etc.)
return toServerSentEventsResponse(stream);

// Just the ReadableStream (for custom Response construction)
const readableStream = toServerSentEventsStream(stream);
return new Response(readableStream, { headers: { "Content-Type": "text/event-stream" } });
```

## Agentic Loop

Control multi-step tool iterations with `maxIterations`:

```typescript
import { chat, maxIterations } from "@tanstack/ai";

const stream = chat({
  adapter: openaiText("gpt-5.2"),
  messages,
  tools: [getWeather, getClothingAdvice],
  agentLoopStrategy: maxIterations(20), // default is 5
});
```

## One-Shot (Non-Streaming)

```typescript
const response = await chat({
  adapter: openaiText("gpt-5.2"),
  messages: [{ role: "user", content: "Capital of France?" }],
  stream: false, // returns Promise<string>
});
```

## Environment Variables

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```
