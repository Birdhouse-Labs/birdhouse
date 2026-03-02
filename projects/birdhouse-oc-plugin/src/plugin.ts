import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";

/**
 * Birdhouse OpenCode Plugin
 * 
 * Exposes agent management tools that integrate with Birdhouse API.
 * Tools: agent_create, agent_read, agent_reply, agent_tree, birdhouse_export_agent_markdown, birdhouse_agent_tree, birdhouse_export_tree_markdown
 * 
 * NOTE: Title guidance synchronized with title-prompt.ts (source of truth)
 */
export const BirdhousePlugin: Plugin = async ({ client, directory }) => {
  // Birdhouse server URL - REQUIRED via env variable
  const BIRDHOUSE_SERVER = process.env.BIRDHOUSE_SERVER;
  
  if (!BIRDHOUSE_SERVER) {
    throw new Error(
      'BIRDHOUSE_SERVER environment variable is required.\n' +
      'Please set it when starting OpenCode:\n' +
      '  export BIRDHOUSE_SERVER=http://localhost:50121\n' +
      '  opencode\n' +
      'Or inline:\n' +
      '  BIRDHOUSE_SERVER=http://localhost:50121 opencode'
    );
  }
  
  // Workspace ID - REQUIRED for multi-workspace support
  const WORKSPACE_ID: string = (() => {
    const workspaceId = process.env.BIRDHOUSE_WORKSPACE_ID;
    if (!workspaceId) {
      throw new Error(
        'BIRDHOUSE_WORKSPACE_ID environment variable is required.\n' +
        'This should be set automatically when Birdhouse spawns OpenCode.\n' +
        'If you see this error, OpenCode was not started correctly.'
      );
    }
    return workspaceId;
  })();
  
  /**
   * Helper: Get headers with workspace context
   */
  function getHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Birdhouse-Workspace-ID': WORKSPACE_ID,
      ...additionalHeaders,
    };
  }
  
  /**
   * Helper: Get current agent's agent_id from session_id
   * Looks up in Birdhouse's agents table via API
   */
  async function getCurrentAgentId(sessionId: string): Promise<string | null> {
    try {
      const response = await fetch(`${BIRDHOUSE_SERVER}/aapi/agents/by-session/${sessionId}`, {
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        console.error(`Failed to lookup agent by session ${sessionId}: ${response.status}`);
        return null;
      }
      
      const agent = await response.json() as any;
      return agent.id;
    } catch (error) {
      console.error('Error getting current agent ID:', error);
      return null;
    }
  }
  
  return {
    tool: {
      /**
       * Create a new agent with prompt and optional cloning
       */
      agent_create: tool({
        description: `Create a new AI agent with a prompt. Optionally clone from yourself or another agent to branch conversations. The new agent will be a child of the source (when cloning) or current agent. By default waits for completion. Set wait=false for async.

IMPORTANT: If you see "The operation timed out" error, the agent was successfully created and is still working! Timeouts happen for tasks >5 minutes but the agent continues in the background. Use agent_read(agent_id) or agent_tree() to check on it.`,
        args: {
          prompt: tool.schema.string().describe("Task prompt for the agent"),
          title: tool.schema.string().describe("Title for the agent. Lead with the subject/topic (not action verbs). First 50 chars matter most (browser tabs). Keep technical terms exact. Add searchable context. Example: 'Authentication errors after session refresh' not 'Debugging auth'"),
          
          // Cloning parameters
          from_self: tool.schema.boolean().optional().describe("Clone from your own session. Creates a child that continues your conversation from right before your last message. Cannot be used with from_agent_id."),
          from_agent_id: tool.schema.string().optional().describe("Clone from another agent's session (e.g., 'agent_abc123'). Creates a child that continues that agent's conversation. Cannot be used with from_self."),
          from_message_id: tool.schema.string().optional().describe("When cloning, fork from this specific message ID (can be user or assistant message). If omitted with from_self, automatically forks from before your last message. If omitted with from_agent_id, clones entire conversation."),
          
          // Optional parameters
          model: tool.schema.string().optional().describe("Model to use. Defaults to source agent's model when cloning, or parent agent's model when not cloning."),
          wait: tool.schema.boolean().optional().describe("Wait for agent to complete before returning (default: true). Set to false for async fire-and-forget creation."),
        },
        async execute({ prompt, title, from_self, from_agent_id, from_message_id, model, wait }, ctx) {
          try {
            // Validation
            if (from_self && from_agent_id) {
              return "Error: Cannot specify both from_self and from_agent_id. Choose one.";
            }
            
            if (from_message_id && !from_self && !from_agent_id) {
              return "Error: from_message_id requires either from_self or from_agent_id to be specified.";
            }
            
            if (!title) {
              return "Error: title is required.";
            }
            
            // Build request body
            const body: any = {
              prompt,
              title,
            };
            
            if (from_self) body.from_self = true;
            if (from_agent_id) body.from_agent_id = from_agent_id;
            if (from_message_id) body.from_message_id = from_message_id;
            if (model) body.model = model;
            if (wait !== undefined) body.wait = wait;
            
            // Create agent via Birdhouse API (now handles cloning + prompt in one call)
            const createResponse = await fetch(`${BIRDHOUSE_SERVER}/aapi/agents`, {
              method: 'POST',
              headers: getHeaders({
                'X-Session-ID': ctx.sessionID, // For from_self support
              }),
              body: JSON.stringify(body),
            });
            
            if (!createResponse.ok) {
              const error = await createResponse.text();
              
              // Parse error for better messages
              let errorMsg = `Error creating agent: ${createResponse.status}`;
              try {
                const errorData = JSON.parse(error);
                if (errorData.error) {
                  errorMsg = errorData.error;
                }
              } catch {
                errorMsg += `\n${error}`;
              }
              
              return errorMsg;
            }
            
            const agent = await createResponse.json() as any;
            
            // Format response based on wait mode
            const shouldWait = wait !== false; // Default to true
            
            if (shouldWait && agent.parts) {
              // Blocking mode - agent completed, return results
              const cloneInfo = from_self 
                ? "Cloned from yourself" 
                : from_agent_id 
                  ? `Cloned from ${from_agent_id}` 
                  : "Fresh agent";
              
              return `✅ Agent ${agent.id} completed

${cloneInfo}
Title: ${agent.title}
Model: ${agent.model}

Response:
${JSON.stringify(agent.parts, null, 2)}`;
            } else {
              // Async mode - agent is working in background
              const cloneInfo = from_self 
                ? "Cloned from yourself" 
                : from_agent_id 
                  ? `Cloned from ${from_agent_id}` 
                  : "Fresh agent";
              
              return `✅ Created agent: ${agent.id}

${cloneInfo}
Title: ${agent.title}
Model: ${agent.model}
Session: ${agent.session_id}

The agent is now working in the background. Use agent_read to wait for completion:
  agent_read({ agent_id: "${agent.id}" })`;
            }
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Timeout: Agent was created successfully, just waiting timed out
            if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
              return `⏱️ Agent creation timed out while waiting for completion

This is normal for long-running tasks (>5 minutes). Your agent was created 
successfully and continues working in the background.

Next steps:
  1. Use agent_tree() to find your agent's ID
  2. Use agent_read({ agent_id: "agent_xxx" }) to wait for results

Note: For long tasks, consider using wait=false when creating agents.`;
            }
            
            // Connection error: Server might be down
            if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
              return `Error creating agent: ${errorMessage}

Make sure Birdhouse server is running at ${BIRDHOUSE_SERVER}`;
            }
            
            // Generic error: Don't assume server is down
            return `Error creating agent: ${errorMessage}

If you see connection errors, make sure Birdhouse server is running at ${BIRDHOUSE_SERVER}`;
          }
        },
      }),
      
      /**
       * Read messages from an agent (returns raw JSON)
       */
      agent_read: tool({
        description: "Read an agent's messages as raw JSON. By default, waits for the agent to complete before returning messages. Use skip_wait=true to read immediately without waiting. Use latest_turn=true to get all messages in the current turn. Use all=true for full conversation.",
        args: {
          agent_id: tool.schema.string().describe("Agent ID to read from (e.g., 'agent_abc123')"),
          skip_wait: tool.schema.boolean().optional().describe("Skip waiting for agent completion and return immediately. Default: false (waits for completion)."),
          latest_turn: tool.schema.boolean().optional().describe("Get all messages in the current turn (since last user message). Default: false."),
          all: tool.schema.boolean().optional().describe("Read entire conversation including all user and assistant messages. Default: false."),
        },
        async execute({ agent_id, skip_wait = false, latest_turn = false, all = false }, ctx) {
          try {
            // WAIT FOR COMPLETION (unless skip_wait=true)
            if (!skip_wait) {
              // Call Birdhouse wait endpoint (which proxies to OpenCode's wait)
              const waitResponse = await fetch(`${BIRDHOUSE_SERVER}/aapi/agents/${agent_id}/wait`, {
                headers: getHeaders(),
              });
              
              if (!waitResponse.ok) {
                const error = await waitResponse.text();
                return `Error waiting for agent ${agent_id}: ${waitResponse.status} ${error}`;
              }
              
              // Agent completed, continue to fetch messages below
            }
            
            // FETCH MESSAGES (after waiting or immediately if skip_wait=true)
            // Server handles selection via mode parameter
            const mode = all ? 'all' : (latest_turn ? 'latest_turn' : 'last');
            const response = await fetch(
              `${BIRDHOUSE_SERVER}/aapi/agents/${agent_id}/messages?mode=${mode}`,
              {
                headers: getHeaders(),
              }
            );
            
            if (!response.ok) {
              const error = await response.text();
              return `Error reading agent: ${response.status} ${error}`;
            }
            
            const messages = await response.json() as any[];
            
            if (messages.length === 0) {
              return `Agent ${agent_id} has no messages yet.

${skip_wait ? 'The agent may still be working. Try again without skip_wait to wait for completion.' : 'Agent completed but produced no messages.'}`;
            }
            
            // Messages are already selected AND filtered by server
            const modeLabel = all ? 'all messages' : (latest_turn ? 'latest turn' : 'last assistant message');
            return `Agent: ${agent_id}
Mode: ${modeLabel}
Messages: ${messages.length}

${JSON.stringify(messages, null, 2)}`;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Timeout: Agent still working
            if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
              return `⏱️ Timeout while waiting for agent ${agent_id}

The agent is still working (>5 minutes). Try:
  1. Wait longer: agent_read({ agent_id: "${agent_id}" })
  2. Check status: agent_tree()
  3. Read partial results: agent_read({ agent_id: "${agent_id}", skip_wait: true })`;
            }
            
            // Connection error
            if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
              return `Error reading agent: ${errorMessage}

Make sure Birdhouse server is running at ${BIRDHOUSE_SERVER}`;
            }
            
            // Generic
            return `Error reading agent: ${errorMessage}`;
          }
        },
      }),
      
      /**
       * View the full tree hierarchy for your agent's tree
       */
      agent_tree: tool({
        description: "View the full tree hierarchy for your agent's tree. Shows all agents in the tree with their IDs, titles, models, and level indicators. Your position in the tree is marked with [THIS IS YOU]. Use this to understand the agent tree structure and see all related agents.",
        args: {},
        async execute(args, ctx) {
          try {
            // Get current agent ID
            const currentAgentId = await getCurrentAgentId(ctx.sessionID);
            
            if (!currentAgentId) {
              return `Error: Could not determine agent ID. This session may not be registered with Birdhouse yet.`;
            }
            
            // Request tree with requesting_agent_id query param for [THIS IS YOU] marker
            const response = await fetch(`${BIRDHOUSE_SERVER}/aapi/agents/${currentAgentId}/tree?requesting_agent_id=${currentAgentId}`, {
              headers: getHeaders(),
            });
            
            if (!response.ok) {
              const error = await response.text();
              
              // Parse error for better messages
              let errorMsg = `Error getting tree: ${response.status}`;
              try {
                const errorData = JSON.parse(error);
                if (errorData.error) {
                  errorMsg = errorData.error;
                }
              } catch {
                errorMsg += `\n${error}`;
              }
              
              return errorMsg;
            }
            
            // Response is plain text with formatted tree
            const treeText = await response.text();
            
            return treeText;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Connection error
            if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
              return `Error getting agent tree: ${errorMessage}

Make sure Birdhouse server is running at ${BIRDHOUSE_SERVER}`;
            }
            
            // Generic (less likely to be connection issue)
            return `Error getting agent tree: ${errorMessage}`;
          }
        },
      }),

      /**
       * Send a follow-up message to an existing agent
       */
      agent_reply: tool({
        description: "Send a follow-up message to an existing agent to provide feedback, ask clarifying questions, or continue the conversation. By default waits for the agent's response. Set wait=false for async.",
        args: {
          agent_id: tool.schema.string().describe("Agent ID to send message to (e.g., 'agent_abc123')"),
          message: tool.schema.string().describe("Follow-up message or feedback to send to the agent"),
          wait: tool.schema.boolean().optional().describe("Wait for agent's response (default: true). Set to false for async fire-and-forget."),
        },
        async execute({ agent_id, message, wait }, ctx) {
          try {
            const shouldWait = wait !== false; // Default to true
            const waitParam = shouldWait ? 'true' : 'false';
            
            // Send message to agent
            const response = await fetch(`${BIRDHOUSE_SERVER}/aapi/agents/${agent_id}/messages?wait=${waitParam}`, {
              method: 'POST',
              headers: getHeaders({
                'X-Session-ID': ctx.sessionID, // For agent signature
              }),
              body: JSON.stringify({ text: message }),
            });
            
            if (!response.ok) {
              const error = await response.text();
              
              // Parse error for better messages
              let errorMsg = `Error sending message to agent ${agent_id}: ${response.status}`;
              try {
                const errorData = JSON.parse(error);
                if (errorData.error) {
                  errorMsg = errorData.error;
                  
                  // Helpful hints for common errors
                  if (errorMsg.includes('not found')) {
                    errorMsg += `\n\nThe agent ${agent_id} does not exist. Make sure:\n1. You're using the correct agent_id\n2. The agent was created via agent_create`;
                  }
                }
              } catch {
                errorMsg += `\n${error}`;
              }
              
              return errorMsg;
            }
            
            if (!shouldWait) {
              // Async mode - message sent, agent working in background
              return `✅ Message sent to agent ${agent_id}

The agent is now processing your message in the background.
Use agent_read to wait for the response:
  agent_read({ agent_id: "${agent_id}" })`;
            }
            
            // Blocking mode - agent completed, return response
            // Response is already filtered by /aapi endpoint
            const messageData = await response.json() as any;
            
            return `✅ Agent ${agent_id} responded:

${JSON.stringify(messageData, null, 2)}`;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Timeout: Reply was sent, waiting timed out
            if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
              return `⏱️ Timeout while waiting for agent ${agent_id} response

Your message was delivered successfully. The agent is working on it (>5 minutes).

Next steps:
  1. Wait for response: agent_read({ agent_id: "${agent_id}" })
  2. Check status: agent_tree()
  
Note: For long tasks, use wait=false when sending messages.`;
            }
            
            // Connection error
            if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
              return `Error sending reply: ${errorMessage}

Make sure Birdhouse server is running at ${BIRDHOUSE_SERVER}`;
            }
            
            // Generic
            return `Error sending reply: ${errorMessage}`;
          }
        },
      }),
      
      /**
       * Export agent timeline as markdown to a file
       */
      birdhouse_export_agent_markdown: tool({
        description: "Export a single agent's timeline as markdown and save to a file. Returns the file path where the markdown was written. Use this to share agent conversations with humans for review, documentation, or archival.",
        args: {
          agent_id: tool.schema.string().describe("Agent ID to export (e.g., 'agent_abc123')"),
          directory: tool.schema.string().describe("Directory where the file should be written. Can be absolute (e.g., '/Users/name/Downloads') or relative to workspace root (e.g., '.', 'tmp/exports'). Required - agent must choose appropriate location based on user context."),
        },
        async execute({ agent_id, directory }, ctx) {
          try {
            // Call backend API to export and write file
            const response = await fetch(`${BIRDHOUSE_SERVER}/aapi/agents/${agent_id}/export`, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ directory }),
            });
            
            if (!response.ok) {
              const error = await response.text();
              
              // Parse error for better messages
              let errorMsg = `Error exporting agent ${agent_id}: ${response.status}`;
              try {
                const errorData = JSON.parse(error);
                if (errorData.error) {
                  errorMsg = errorData.error;
                  
                  // Helpful hints for common errors
                  if (response.status === 404) {
                    errorMsg += `\n\nThe agent ${agent_id} does not exist. Make sure:\n1. You're using the correct agent_id\n2. The agent was created via agent_create`;
                  } else if (errorMsg.includes('directory parameter is required')) {
                    errorMsg += `\n\nYou must specify where to write the file. Examples:\n  - Current directory: "."\n  - Exports folder: "tmp/exports"\n  - Downloads: "/Users/name/Downloads"`;
                  }
                }
              } catch {
                errorMsg += `\n${error}`;
              }
              
              return errorMsg;
            }
            
            // Parse response
            const result = await response.json() as {
              filepath: string;
              filename: string;
              agent_id: string;
            };
            
            // Return success message with filepath
            return `✅ Exported agent ${result.agent_id}

Filename: ${result.filename}
Location: ${result.filepath}

The markdown file contains the complete conversation timeline including all messages, tool calls, reasoning, and system events.`;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Connection error
            if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
              return `Error exporting agent: ${errorMessage}

Make sure Birdhouse server is running at ${BIRDHOUSE_SERVER}`;
            }
            
            // Generic
            return `Error exporting agent: ${errorMessage}`;
          }
        },
      }),
      
      /**
       * Get tree structure for any agent ID
       */
      birdhouse_agent_tree: tool({
        description: "Get the formatted tree structure for any agent ID. Returns the same markdown-formatted tree that agent_tree() returns, but for a specified agent's tree instead of your own. Use this to explore other agents' hierarchies, analyze tree structures, or implement export patterns.",
        args: {
          agent_id: tool.schema.string().describe("Agent ID to get tree for (e.g., 'agent_abc123'). This will be the root of the returned tree. The tree will include this agent and all its descendants."),
        },
        async execute({ agent_id }, ctx) {
          try {
            // Call backend API to get tree for specified agent
            const response = await fetch(`${BIRDHOUSE_SERVER}/aapi/agents/${agent_id}/tree`, {
              headers: getHeaders(),
            });
            
            if (!response.ok) {
              const error = await response.text();
              
              // Parse error for better messages
              let errorMsg = `Error getting tree for agent ${agent_id}: ${response.status}`;
              try {
                const errorData = JSON.parse(error);
                if (errorData.error) {
                  errorMsg = errorData.error;
                  
                  // Helpful hints for common errors
                  if (response.status === 404) {
                    errorMsg += `\n\nThe agent ${agent_id} does not exist. Make sure:\n1. You're using the correct agent_id\n2. The agent was created via agent_create`;
                  }
                }
              } catch {
                errorMsg += `\n${error}`;
              }
              
              return errorMsg;
            }
            
            // Return formatted tree text
            const treeText = await response.text();
            return treeText;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Connection error
            if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
              return `Error getting agent tree: ${errorMessage}

Make sure Birdhouse server is running at ${BIRDHOUSE_SERVER}`;
            }
            
            // Generic
            return `Error getting agent tree: ${errorMessage}`;
          }
        },
      }),
      
      /**
       * Export entire agent tree in a single call
       */
      birdhouse_export_tree_markdown: tool({
        description: "Export an entire agent tree (all agents from a root) in a single call. Writes tree structure, agent data file, and all individual agent markdown files to a directory. Replaces the need for multiple birdhouse_export_agent_markdown calls.",
        args: {
          root_agent_id: tool.schema.string().describe("Root agent ID of the tree to export (e.g., 'agent_abc123'). The endpoint will export this agent and all its descendants."),
          directory: tool.schema.string().describe("Directory where all output files should be written. Can be absolute (e.g., '/Users/name/Downloads/exports') or relative to workspace root (e.g., 'tmp/tree-exports'). The directory will be created if it doesn't exist."),
        },
        async execute({ root_agent_id, directory }, ctx) {
          try {
            // Call backend API to export entire tree
            const response = await fetch(`${BIRDHOUSE_SERVER}/aapi/agents/${root_agent_id}/export-tree`, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ directory }),
            });
            
            if (!response.ok) {
              const error = await response.text();
              
              // Parse error for better messages
              let errorMsg = `Error exporting tree for agent ${root_agent_id}: ${response.status}`;
              try {
                const errorData = JSON.parse(error);
                if (errorData.error) {
                  errorMsg = errorData.error;
                  
                  // Helpful hints for common errors
                  if (response.status === 404) {
                    errorMsg += `\n\nThe agent ${root_agent_id} does not exist. Make sure:\n1. You're using the correct agent_id\n2. The agent was created via agent_create`;
                  } else if (errorMsg.includes('directory parameter is required')) {
                    errorMsg += `\n\nYou must specify where to write files. Examples:\n  - Current directory: "."\n  - Exports folder: "tmp/tree-exports"\n  - Downloads: "/Users/name/Downloads/exports"`;
                  }
                }
              } catch {
                errorMsg += `\n${error}`;
              }
              
              return errorMsg;
            }
            
            // Parse response
            const result = await response.json() as {
              success: boolean;
              directory: string;
              files_created: {
                tree: string;
                agent_data: string;
                agents: string[];
              };
              summary: {
                total_agents: number;
                exported_count: number;
                failed_count: number;
                failures: Array<{ agent_id: string; error: string }>;
              };
            };
            
            // Format success message
            let message = `✅ Exported agent tree from ${root_agent_id}\n\n`;
            message += `Files created in ${result.directory}:\n`;
            message += `- ${result.files_created.tree} (tree structure)\n`;
            message += `- ${result.files_created.agent_data} (agent list for concatenation)\n`;
            message += `- ${result.summary.exported_count} agent markdown files`;
            
            if (result.summary.failed_count > 0) {
              message += ` (${result.summary.failed_count} failed)`;
            }
            
            message += `\n\nTotal agents exported: ${result.summary.exported_count}/${result.summary.total_agents}`;
            
            // List failures if any
            if (result.summary.failures.length > 0) {
              message += `\n\nFailed exports:`;
              for (const failure of result.summary.failures) {
                message += `\n- ${failure.agent_id}: ${failure.error}`;
              }
            }
            
            return message;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Connection error
            if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
              return `Error exporting tree: ${errorMessage}

Make sure Birdhouse server is running at ${BIRDHOUSE_SERVER}`;
            }
            
            // Generic
            return `Error exporting tree: ${errorMessage}`;
          }
        },
      }),
    },
  };
};

export default BirdhousePlugin;
