import { sseRouter } from './routes/sse';
import { streamableHttpRouter } from './routes/streamable-http';
import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middlewares/auth';
import morgan from 'morgan';
import { customMorganFormat } from './middlewares/logging';

const app = express();

declare global {
  namespace Express {
    interface Request {
      token: string;
      userId: string;
    }
  }
}

app.use(express.json());
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'mcp-session-id',
      'x-chat-id',
      'last-event-id',
    ],
  })
);
app.use(morgan(customMorganFormat));

app.get('/', (req, res) => {
  console.log('Health check endpoint called ');
  res.status(200).send(
    `MCP Server is running. 
     Use / sse endpoint for SSE connections and / mcp endpoint for streamable HTTP connections`
  );
});

// Legacy SSE endpoints with auth
app.use('/sse', authMiddleware, sseRouter);

// Streamable HTTP with auth
app.use('/mcp', authMiddleware, streamableHttpRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `⚡️ Membrane MCP Server is running on port ${PORT} ENV: ${process.env.NODE_ENV}`
  );
});
