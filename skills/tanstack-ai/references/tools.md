# Tool System

## Table of Contents
- [Tool Definition](#tool-definition)
- [Server Tools](#server-tools)
- [Client Tools](#client-tools)
- [Hybrid Tools](#hybrid-tools)
- [Tool Approval](#tool-approval)
- [Type Safety](#type-safety)
- [Tool States](#tool-states)
- [Agentic Cycle](#agentic-cycle)
- [Tool Organization Pattern](#tool-organization-pattern)
- [Best Practices](#best-practices)

## Tool Definition

Two-step: define schema, then implement for server or client.

```typescript
import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

const getWeatherDef = toolDefinition({
  name: "get_weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
    unit: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
  needsApproval: false, // optional — enables approval flow
});
```

Supports Zod schemas (recommended, full type safety) and raw JSON Schema objects (typed as `any`).

## Server Tools

Execute automatically on server with DB/API access:

```typescript
const getWeather = getWeatherDef.server(async ({ location, unit }) => {
  const response = await fetch(`https://api.weather.com/v1/current?location=${location}`);
  const data = await response.json();
  return { temperature: data.temperature, conditions: data.conditions };
});

// Use in chat()
const stream = chat({
  adapter: openaiText("gpt-5.2"),
  messages,
  tools: [getWeather],
});
```

Error handling pattern:

```typescript
const getUserData = getUserDataDef.server(async ({ userId }) => {
  try {
    const user = await db.users.findUnique({ where: { id: userId } });
    if (!user) return { error: "User not found" };
    return { name: user.name, email: user.email };
  } catch (error) {
    return { error: "Failed to fetch user data" };
  }
});
```

## Client Tools

Execute in browser for UI updates, localStorage, browser APIs. **Automatically executed** — no `onToolCall` needed.

```typescript
// tools/definitions.ts — shared
export const updateUIDef = toolDefinition({
  name: "update_ui",
  description: "Update the UI with new information",
  inputSchema: z.object({
    message: z.string(),
    type: z.enum(["success", "error", "info"]),
  }),
  outputSchema: z.object({ success: z.boolean() }),
});

// React component
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { clientTools, createChatClientOptions } from "@tanstack/ai-client";

function ChatComponent() {
  const [notification, setNotification] = useState(null);

  const updateUI = updateUIDef.client((input) => {
    setNotification({ message: input.message, type: input.type });
    return { success: true };
  });

  const tools = clientTools(updateUI);
  const { messages, sendMessage } = useChat({
    connection: fetchServerSentEvents("/api/chat"),
    tools,
  });
  // ...
}
```

Server side: pass definitions (not implementations) so LLM knows about client tools:

```typescript
chat({
  adapter: openaiText("gpt-5.2"),
  messages,
  tools: [updateUIDef], // definition only — client executes
});
```

## Hybrid Tools

Same definition, both server and client implementations:

```typescript
const addToCartDef = toolDefinition({
  name: "add_to_cart",
  description: "Add item to shopping cart",
  inputSchema: z.object({ itemId: z.string(), quantity: z.number() }),
  outputSchema: z.object({ success: z.boolean(), cartId: z.string() }),
  needsApproval: true,
});

// Server — store in DB
const addToCartServer = addToCartDef.server(async (input) => {
  const cart = await db.carts.create({ data: { itemId: input.itemId, quantity: input.quantity } });
  return { success: true, cartId: cart.id };
});

// Client — update local wishlist
const addToCartClient = addToCartDef.client((input) => {
  const wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");
  wishlist.push(input.itemId);
  localStorage.setItem("wishlist", JSON.stringify(wishlist));
  return { success: true, cartId: "local" };
});

// Server: choose execution context
chat({ ..., tools: [addToCartDef] });    // client executes
chat({ ..., tools: [addToCartServer] }); // server executes
```

## Tool Approval

Set `needsApproval: true`. Handle with `addToolApprovalResponse`:

```typescript
const sendEmailDef = toolDefinition({
  name: "send_email",
  description: "Send an email",
  inputSchema: z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  needsApproval: true,
});

// React component
function ChatWithApproval() {
  const { messages, sendMessage, addToolApprovalResponse } = useChat({
    connection: fetchServerSentEvents("/api/chat"),
  });

  return (
    <div>
      {messages.map((message) =>
        message.parts.map((part) => {
          if (
            part.type === "tool-call" &&
            part.state === "approval-requested" &&
            part.approval
          ) {
            return (
              <div key={part.id}>
                <p>Approve: {part.name}</p>
                <pre>{JSON.stringify(part.input, null, 2)}</pre>
                <button onClick={() => addToolApprovalResponse({ id: part.approval!.id, approved: true })}>
                  Approve
                </button>
                <button onClick={() => addToolApprovalResponse({ id: part.approval!.id, approved: false })}>
                  Deny
                </button>
              </div>
            );
          }
          return null;
        })
      )}
    </div>
  );
}
```

Approval states: `approval-requested` -> `executing` -> `output-available` | `output-error` | `cancelled`

## Type Safety

Full end-to-end type inference with `clientTools()` + `createChatClientOptions()`:

```typescript
import { clientTools, createChatClientOptions, type InferChatMessages } from "@tanstack/ai-client";

const tools = clientTools(updateUI, saveToStorage); // no 'as const' needed!
const chatOptions = createChatClientOptions({
  connection: fetchServerSentEvents("/api/chat"),
  tools,
});
type ChatMessages = InferChatMessages<typeof chatOptions>;

// Usage: part.name is discriminated union, part.input/output typed from Zod
messages.forEach((message) => {
  message.parts.forEach((part) => {
    if (part.type === "tool-call" && part.name === "update_ui") {
      part.input.message;  // string
      part.input.type;     // "success" | "error" | "info"
      part.output?.success; // boolean
    }
  });
});
```

## Tool States

Tools go through observable lifecycle states:

- `awaiting-input` — model intends to call tool, args not yet arrived
- `input-streaming` — model streaming arguments (partial input available)
- `input-complete` — all arguments received, tool executing
- `approval-requested` — waiting for user approval (if `needsApproval: true`)
- `executing` — approved, now running
- `output-available` — completed successfully
- `output-error` — execution failed
- `cancelled` — user denied approval

Render tool states:

```typescript
function ToolCallDisplay({ part }: { part: ToolCallPart }) {
  if (part.state === "awaiting-input") return <div>Waiting for arguments...</div>;
  if (part.state === "input-streaming") return <div>Receiving arguments...</div>;
  if (part.state === "input-complete") return <div>Executing...</div>;
  if (part.output) return <div>Completed</div>;
  return null;
}
```

## Agentic Cycle

LLM repeatedly calls tools until task complete. Control with `maxIterations`:

```typescript
import { chat, maxIterations } from "@tanstack/ai";

const stream = chat({
  adapter: openaiText("gpt-5.2"),
  messages,
  tools: [getWeather, getClothingAdvice],
  agentLoopStrategy: maxIterations(20), // default: 5
});
```

Flow: User message -> LLM -> tool call -> execute -> result -> LLM -> (repeat or respond)

## Tool Organization Pattern

Separate definitions from implementations:

```
tools/
  definitions.ts  — shared between server and client (toolDefinition calls)
  server.ts       — .server() implementations
  client.ts       — .client() implementations
```

## Best Practices

- Keep tools focused — one tool, one responsibility
- Use Zod schemas for full type safety (JSON Schema loses type inference)
- Include `.describe()` on schema fields to help LLM understand parameters
- Handle errors gracefully — return error info in output schema
- Use `needsApproval: true` for sensitive operations (payments, deletions, emails)
- Keep client tools lightweight — avoid heavy computation in browser
- Use `clientTools()` helper — provides proper type inference without `as const`
