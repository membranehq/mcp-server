import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getActionsForAllConnectedApp } from './membrane/get-actions-for-all-connected-app';
import { Action, IntegrationAppClient } from '@integration-app/sdk/dist';
import { MockIntegrationAppClient } from './mocks/mock-integration-app-client';
import { isTestEnvironment } from './constants';
import { zodFromJsonSchema } from './json-schema-to-zod';
import { ZodRawShape } from 'zod';
import pkg from '../../../package.json';
import { getActionsByKeys } from './membrane/get-actions-by-keys';

/**
 * Register a tool to the MCP server while adding some standardization
 */
function addServerTool({
  mcpServer,
  action,
  membrane,
}: {
  mcpServer: McpServer;
  action: Action;
  membrane: IntegrationAppClient;
}) {
  const toolParametersSchema = zodFromJsonSchema(
    action.inputSchema || {
      type: 'object',
      properties: undefined,
    }
  ) as unknown as ZodRawShape;

  const integrationKey = action.integration?.key;
  const integrationName = action.integration?.name;

  if (!integrationKey || !integrationName) {
    return;
  }

  /**
   * Include integration name/key to avoid collisions
   * use underscore to make it easier to tell the integration key fo the tool
   */
  let toolName = `${integrationKey}_${action.key}`;
  let toolDescription = `${integrationName}: ${action.name}`;

  const tool = mcpServer.registerTool(
    toolName,
    {
      title: toolDescription,
      description: toolDescription,
      inputSchema: toolParametersSchema,
    },
    async args => {
      const result = await membrane
        .actionInstance({
          autoCreate: true,
          integrationKey,
          parentKey: action.key,
        })
        .run(args);

      return {
        content: [
          {
            type: 'text',
            text: result.output ? JSON.stringify(result.output) : 'No output',
          },
        ],
      };
    }
  );

  return { tool, toolName };
}

export interface CreateMcpServerParams {
  userAccessToken: string;
  apps?: string[];
  mode?: 'dynamic' | 'static';
}

export const createMcpServer = async ({
  userAccessToken,
  apps,
  mode = 'static',
}: CreateMcpServerParams) => {
  const mcpServer = new McpServer(
    {
      name: 'Membrane MCP Server',
      version: pkg.version,
      description: pkg.description,
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    }
  );

  let membrane: IntegrationAppClient;

  if (isTestEnvironment) {
    membrane = new MockIntegrationAppClient(userAccessToken) as any;
  } else {
    membrane = new IntegrationAppClient({ token: userAccessToken });
  }

  /**
   * Get actions for all connected apps on membrane
   *
   * If `apps` is provided, MCP server only return tools for the specified apps
   */
  const actions = await getActionsForAllConnectedApp({ membrane, apps });

  if (mode === 'static') {
    for (const action of actions) {
      addServerTool({ mcpServer, action, membrane });
    }
  }

  if (mode === 'dynamic') {
    const registeredTools: Record<string, RegisteredTool> = {};
    const enabledTools: string[] = [];

    mcpServer.registerTool(
      'enable-tools',
      {
        title: 'Enable Tools',
        description: 'Enable a list of tools for the session',
        inputSchema: zodFromJsonSchema({
          type: 'object',
          properties: {
            tools: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        }),
      },

      async args => {
        console.log('>>> Enabling tools', args.tools);

        // Disable all enabled tools
        for (const tool of enabledTools) {
          registeredTools[tool]?.disable();
        }

        // Enable new tools
        for (const tool of args.tools) {
          /**
           * There are cases where the tool client is trying to enable is not a registered tool.
           * In that case, we need to get the action from membrane, register it and enable it.
           */
          const isToolRegistered = registeredTools[tool];

          if (isToolRegistered) {
            registeredTools[tool].enable();
            enabledTools.push(tool);
          } else {
            const actions = await getActionsByKeys(
              membrane,
              args.tools.map((toolKey: string) => {
                const [integrationKey, actionKey] = toolKey.split('_');

                return {
                  key: actionKey,
                  integrationKey,
                };
              })
            );

            for (const action of actions) {
              if (action) {
                const addedTool = addServerTool({ mcpServer, action, membrane });
                if (addedTool) {
                  registeredTools[addedTool.toolName] = addedTool.tool;
                  addedTool.tool.enable();
                  enabledTools.push(addedTool.toolName);
                }
              }
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: 'Tools enabled',
            },
          ],
        };
      }
    );

    for (const action of actions) {
      const addToolResult = addServerTool({ mcpServer, action, membrane });

      if (addToolResult) {
        registeredTools[addToolResult.toolName] = addToolResult.tool;
        addToolResult.tool.disable();
      }

      /**
       * TODO: Add resources to the server
       */
    }
  }

  return { mcpServer };
};
