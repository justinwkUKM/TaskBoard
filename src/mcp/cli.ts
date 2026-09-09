#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTaskBoardMcpServer } from './server';

async function run() {
  const apiUrl = process.env.TASKBOARD_API_URL || 'https://taskboard.waqasobeidy.com';
  const agentToken = process.env.TASKBOARD_AGENT_TOKEN;
  const boardId = process.env.TASKBOARD_BOARD_ID;

  if (!agentToken) {
    console.error('Error: TASKBOARD_AGENT_TOKEN environment variable is required.');
    console.error('Please generate an agent token in Board Settings -> AI Agents & MCP.');
    process.exit(1);
  }

  const server = createTaskBoardMcpServer({
    apiUrl,
    agentToken,
    boardId
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module || !process.env.VITEST) {
  run().catch(err => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}
