# Membrane MCP Server

<a href="https://getmembrane.com/">
  <img width="1148" alt="Screenshot 2025-07-07 at 23 03 05" src="https://github.com/user-attachments/assets/39f6cc74-a689-4657-91f3-ee8358c05e31" />
</a>

The Membrane MCP Server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server, it provides actions for connected integrations on Membrane as tools.

Here's our official [AI Agent Example](https://github.com/membranehq/ai-agent-example) that shows you how to use this MCP server in your application.

### 📋 Prerequisites

- Node.js (v18 or higher)
- A [Membrane](https://getmembrane.com) account

### ⚙️ Installation

```bash
git clone https://github.com/membranehq/mcp-server.git
cd mcp-server
npm install
npm run build
```

### 🛠️ Local Development

To run the development server locally, start it with:

```bash
npm run dev
```

The server will be live at `http://localhost:3000` ⚡️

### 🧪 Running tests

```bash
# Run the server in test mode
npm run start:test

# then run tests
npm test
```

### 🚀 Deployment

Deploy your own instance of this MCP server to any cloud hosting service of your choice.

#### 🐳 Docker

The project includes a Dockerfile for easy containerized deployment.

```bash
docker build -t membrane-mcp-server .
docker run -p 3000:3000 membrane-mcp-server
```

### 🔗 Connecting to the MCP server

This MCP server support two transports:

| Transport                                                                                                              | Endpoint | Status                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| [SSE](https://modelcontextprotocol.io/docs/concepts/transports#server-sent-events-sse-deprecated) (Server‑Sent Events) | `/sse`   | 🔴 **Deprecated** — deprecated as of November 5, 2024 in MCP spec      |
| [HTTP](https://modelcontextprotocol.io/docs/concepts/transports#streamable-http) (Streamable HTTP)                     | `/mcp`   | 🟢 **Recommended** — replaces SSE and supports bidirectional streaming |

### 🔐 Authentication

Provide a [Membrane access token](https://docs.getmembrane.com/docs/authentication#access-token) via query or `Authorization` header:

```http
?token=ACCESS_TOKEN
Authorization: Bearer ACCESS_TOKEN
```

**SSE** (Deprecated)

```js
await client.connect(
  new SSEClientTransport(
    new URL(
      `https://<HOSTED_MCP_SERVER_URL>/sse`
    )
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      },
    }
  )
);
```

**Streamable HTTP** (Recommended)

```js

await client.connect(
  new StreamableHTTPClientTransport(
    new URL(`https://<HOSTED_MCP_SERVER_URL>/mcp`)
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      },
    }
  )
);
```

### ⚡ Static vs Dynamic Mode

By default, the MCP server runs in **static mode**, which means it returns **all available tools** (actions) for all connected integrations.

With **dynamic mode** (`?mode=dynamic`), the server will only return **one tool**: `enable-tools`. You can use this tool to selectively enable the tools you actually need for that session.

In dynamic mode, your implementation should figure out which tools are most relevant to the user's query. Once you've identified them, prompt the LLM to call the `enable-tools` tool with the appropriate list.

Want to see how this works in practice? Check out our [AI Agent Example](https://github.com/membranehq/ai-agent-example).

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client({
  name: 'example-membrane-mcp-client',
  version: '1.0.0',
});

const transport = new StreamableHTTPClientTransport(
  new URL(`https://<HOSTED_MCP_SERVER_URL>/mcp?mode=dynamic`),
  {
    requestInit: {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    },
  }
);

await client.connect(transport);

await client.callTool({
  name: 'enable-tools',
  arguments: {
    tools: ['gmail-send-email', 'gmail-read-email'],
  },
});
```

### 🔧 Getting tools for a specific integrations

In static mode, the MCP server fetches tools from all active connections associated with the provided token.

You can choose to only fetch tools for a specific integration by passing the `apps` query parameter: `/mcp?apps=google-calendar,google-docs`

### 💬 Chat Session Management (Experimental)

The MCP server (streamable-http transport only) supports persistent chat sessions. Include an `x-chat-id` header in your requests to automatically track sessions for that specific chat. This is an experimental feature that we provide in addition to standard MCP sessions.

**Starting a new chat session:**

```http
POST /mcp
Authorization: Bearer YOUR_ACCESS_TOKEN
x-chat-id: my-awesome-chat-123
```

**Retrieving your chat sessions:**

```http
GET /mcp/sessions
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:**

```json
{
  "my-awesome-chat-123": "session-uuid-1",
  "another-chat-456": "session-uuid-2"
}
```

This feature lets you use same session for a conversation. Check out our [AI Agent Example](https://github.com/membranehq/ai-agent-example) to see how this works in practice.

### Configuring other MCP clients

#### 📝 Cursor

To use this server with Cursor, update the `~/.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "membrane": {
      "url": "https://<HOSTED_MCP_SERVER_URL>/sse?token={ACCESS_TOKEN}"
    }
  }
}
```

Restart Cursor for the changes to take effect.

#### 🤖 Claude Desktop

To use this server with Claude, update the config file (Settings > Developer > Edit Config):

```json
{
  "mcpServers": {
    "membrane": {
      "url": "https://<HOSTED_MCP_SERVER_URL>/sse?token={ACCESS_TOKEN}"
    }
  }
}
```

### 🔧 Troubleshooting

- Ensure your access token is valid and you're generating it according to [these instructions](https://docs.getmembrane.com/docs/authentication#access-token)
- Check the MCP server logs for any errors or issues during startup or connection attempts.
- Use the [MCP Inspector](https://www.npmjs.com/package/@modelcontextprotocol/inspector) for testing and debugging
