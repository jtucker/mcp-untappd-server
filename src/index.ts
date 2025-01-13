#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: CLIENT_ID and CLIENT_SECRET environment variables are required');
  process.exit(1);
}

class UntappdServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'untappd-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://api.untappd.com/v4',
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_beer_info',
          description: 'Get information about a specific beer by its ID',
          inputSchema: {
            type: 'object',
            properties: {
              beer_id: {
                type: 'string',
                description: 'The ID of the beer',
              },
            },
            required: ['beer_id'],
          },
        },
        {
          name: 'search_beer',
          description: 'Search for beers by name',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The name of the beer to search for',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_user_checkins',
          description: 'Get the authenticated user\'s check-ins',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'The number of check-ins to retrieve',
                default: 25
              },
            },
            required: ['user_id'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      switch (request.params.name) {
        case 'get_beer_info': {
          const { beer_id } = request.params.arguments;
          try {
            const response = await this.axiosInstance.get(`/beer/info/${beer_id}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(response.data, null, 2),
                },
              ],
            };
          } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Untappd API error: ${
                      error.response?.data.meta.error_detail ?? error.message
                    }`,
                  },
                ],
                isError: true,
              };
            }
            throw error;
          }
        }
        case 'search_beer': {
          const { query } = request.params.arguments;
          try {
            const response = await this.axiosInstance.get('/search/beer', {
              params: { q: query },
            });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(response.data, null, 2),
                },
              ],
            };
          } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Untappd API error: ${
                      error.response?.data.meta.error_detail ?? error.message
                    }`,
                  },
                ],
                isError: true,
              };
            }
            throw error;
          }
        }
        case 'get_user_checkins': {
          const { limit } = request.params.arguments;
          try {
            const response = await this.axiosInstance.get('/user/checkins', {
              params: { limit },
            });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(response.data, null, 2),
                },
              ],
            };
          } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Untappd API error: ${
                      error.response?.data.meta.error_detail ?? error.message
                    }`,
                  },
                ],
                isError: true,
              };
            }
            throw error;
          }
        }
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Untappd MCP server running on stdio');
  }
}

const server = new UntappdServer();
server.run().catch(console.error);
