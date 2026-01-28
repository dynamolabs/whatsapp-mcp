#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Client, LocalAuth, Message, Chat, Contact } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

// WhatsApp client instance
let waClient: Client | null = null;
let isReady = false;
let lastQR = '';

// Initialize WhatsApp client
function initWhatsApp(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (waClient && isReady) {
      resolve();
      return;
    }

    waClient = new Client({
      authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    waClient.on('qr', (qr) => {
      lastQR = qr;
      console.error('\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    });

    waClient.on('ready', () => {
      isReady = true;
      console.error('✅ WhatsApp client is ready!');
      resolve();
    });

    waClient.on('authenticated', () => {
      console.error('🔐 WhatsApp authenticated');
    });

    waClient.on('auth_failure', (msg) => {
      console.error('❌ Authentication failed:', msg);
      reject(new Error('Authentication failed'));
    });

    waClient.on('disconnected', (reason) => {
      console.error('📴 WhatsApp disconnected:', reason);
      isReady = false;
    });

    waClient.initialize().catch(reject);
  });
}

// MCP Server
const server = new Server(
  {
    name: 'whatsapp-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'wa_status',
      description: 'Check WhatsApp connection status and get QR code if not connected',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'wa_send_message',
      description: 'Send a WhatsApp message to a phone number or contact name',
      inputSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Phone number (with country code, e.g., 6281234567890) or contact name',
          },
          message: {
            type: 'string',
            description: 'Message text to send',
          },
        },
        required: ['to', 'message'],
      },
    },
    {
      name: 'wa_get_chats',
      description: 'Get list of recent WhatsApp chats',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of chats to return (default: 20)',
          },
        },
      },
    },
    {
      name: 'wa_get_messages',
      description: 'Get messages from a specific chat',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID or phone number',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to return (default: 20)',
          },
        },
        required: ['chat_id'],
      },
    },
    {
      name: 'wa_search_messages',
      description: 'Search for messages containing specific text',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Text to search for',
          },
          chat_id: {
            type: 'string',
            description: 'Optional: limit search to specific chat',
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 20)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'wa_get_contacts',
      description: 'Get WhatsApp contacts list',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum contacts to return (default: 50)',
          },
        },
      },
    },
    {
      name: 'wa_get_groups',
      description: 'Get list of WhatsApp groups',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum groups to return (default: 20)',
          },
        },
      },
    },
    {
      name: 'wa_get_contact_info',
      description: 'Get detailed info about a contact',
      inputSchema: {
        type: 'object',
        properties: {
          phone_or_name: {
            type: 'string',
            description: 'Phone number or contact name',
          },
        },
        required: ['phone_or_name'],
      },
    },
  ],
}));

// Helper: format phone number to WhatsApp ID
function formatPhoneToId(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Add @c.us suffix if not present
  if (!cleaned.includes('@')) {
    cleaned = `${cleaned}@c.us`;
  }
  
  return cleaned;
}

// Helper: find contact by name or phone
async function findContact(query: string): Promise<string | null> {
  if (!waClient || !isReady) return null;
  
  // If it looks like a phone number
  if (/^\+?\d[\d\s-]+$/.test(query)) {
    return formatPhoneToId(query);
  }
  
  // Search contacts by name
  const contacts = await waClient.getContacts();
  const found = contacts.find(c => 
    c.name?.toLowerCase().includes(query.toLowerCase()) ||
    c.pushname?.toLowerCase().includes(query.toLowerCase())
  );
  
  return found?.id._serialized || null;
}

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'wa_status': {
        if (!waClient) {
          await initWhatsApp();
        }
        
        if (isReady) {
          const info = waClient?.info;
          return {
            content: [{
              type: 'text',
              text: `✅ WhatsApp Connected!\n\n📱 Phone: ${info?.wid?.user || 'Unknown'}\n👤 Name: ${info?.pushname || 'Unknown'}\n🔌 Platform: ${info?.platform || 'Unknown'}`,
            }],
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `⏳ WhatsApp not connected.\n\n📱 Please scan the QR code in the terminal to connect.\n\nIf you don't see a QR code, restart the MCP server.`,
            }],
          };
        }
      }

      case 'wa_send_message': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const to = args?.to as string;
        const message = args?.message as string;

        if (!to || !message) {
          return { content: [{ type: 'text', text: 'Error: "to" and "message" are required' }] };
        }

        const chatId = await findContact(to);
        if (!chatId) {
          return { content: [{ type: 'text', text: `❌ Could not find contact: ${to}` }] };
        }

        await waClient.sendMessage(chatId, message);
        
        return {
          content: [{
            type: 'text',
            text: `✅ Message sent to ${to}!\n\n📝 Message: ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`,
          }],
        };
      }

      case 'wa_get_chats': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const limit = (args?.limit as number) || 20;
        const chats = await waClient.getChats();
        
        let text = '💬 Recent Chats:\n\n';
        
        for (const chat of chats.slice(0, limit)) {
          const unread = chat.unreadCount > 0 ? ` (${chat.unreadCount} unread)` : '';
          const lastMsg = chat.lastMessage?.body?.slice(0, 50) || 'No messages';
          const isGroup = chat.isGroup ? '👥' : '👤';
          
          text += `${isGroup} ${chat.name}${unread}\n`;
          text += `   💬 ${lastMsg}${chat.lastMessage?.body && chat.lastMessage.body.length > 50 ? '...' : ''}\n`;
          text += `   🆔 ${chat.id._serialized}\n\n`;
        }
        
        return { content: [{ type: 'text', text }] };
      }

      case 'wa_get_messages': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatId = args?.chat_id as string;
        const limit = (args?.limit as number) || 20;

        if (!chatId) {
          return { content: [{ type: 'text', text: 'Error: chat_id is required' }] };
        }

        const formattedId = chatId.includes('@') ? chatId : formatPhoneToId(chatId);
        const chat = await waClient.getChatById(formattedId);
        const messages = await chat.fetchMessages({ limit });
        
        let text = `📨 Messages from ${chat.name}:\n\n`;
        
        for (const msg of messages.reverse()) {
          const time = new Date(msg.timestamp * 1000).toLocaleString();
          const from = msg.fromMe ? '📤 You' : `📥 ${msg.author || chat.name}`;
          
          text += `${from} (${time}):\n`;
          text += `${msg.body || '[Media/Sticker]'}\n\n`;
        }
        
        return { content: [{ type: 'text', text }] };
      }

      case 'wa_search_messages': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const query = args?.query as string;
        const chatId = args?.chat_id as string;
        const limit = (args?.limit as number) || 20;

        if (!query) {
          return { content: [{ type: 'text', text: 'Error: query is required' }] };
        }

        let results: Message[] = [];
        
        if (chatId) {
          const formattedId = chatId.includes('@') ? chatId : formatPhoneToId(chatId);
          const chat = await waClient.getChatById(formattedId);
          const messages = await chat.fetchMessages({ limit: 100 });
          results = messages.filter(m => 
            m.body?.toLowerCase().includes(query.toLowerCase())
          );
        } else {
          // Search across all chats (limited)
          const chats = await waClient.getChats();
          for (const chat of chats.slice(0, 10)) {
            try {
              const messages = await chat.fetchMessages({ limit: 50 });
              const found = messages.filter(m => 
                m.body?.toLowerCase().includes(query.toLowerCase())
              );
              results.push(...found);
            } catch (e) {
              // Skip chats that can't be fetched
            }
            if (results.length >= limit) break;
          }
        }
        
        let text = `🔍 Search results for "${query}":\n\n`;
        
        if (results.length === 0) {
          text += 'No messages found.';
        } else {
          for (const msg of results.slice(0, limit)) {
            const time = new Date(msg.timestamp * 1000).toLocaleString();
            const chat = await msg.getChat();
            
            text += `📍 ${chat.name} (${time}):\n`;
            text += `${msg.body?.slice(0, 100)}${msg.body && msg.body.length > 100 ? '...' : ''}\n\n`;
          }
        }
        
        return { content: [{ type: 'text', text }] };
      }

      case 'wa_get_contacts': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const limit = (args?.limit as number) || 50;
        const contacts = await waClient.getContacts();
        
        // Filter to actual contacts (not groups, broadcasts, etc)
        const realContacts = contacts.filter(c => 
          c.isUser && !c.isMe && (c.name || c.pushname)
        );
        
        let text = '👥 Contacts:\n\n';
        
        for (const contact of realContacts.slice(0, limit)) {
          const name = contact.name || contact.pushname || 'Unknown';
          text += `👤 ${name}\n`;
          text += `   📱 ${contact.number}\n`;
          text += `   🆔 ${contact.id._serialized}\n\n`;
        }
        
        text += `\nTotal: ${realContacts.length} contacts`;
        
        return { content: [{ type: 'text', text }] };
      }

      case 'wa_get_groups': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const limit = (args?.limit as number) || 20;
        const chats = await waClient.getChats();
        const groups = chats.filter(c => c.isGroup);
        
        let text = '👥 Groups:\n\n';
        
        for (const group of groups.slice(0, limit)) {
          const chat = group as Chat;
          text += `📱 ${chat.name}\n`;
          text += `   🆔 ${chat.id._serialized}\n`;
          text += `   💬 Last: ${chat.lastMessage?.body?.slice(0, 30) || 'No messages'}...\n\n`;
        }
        
        text += `\nTotal: ${groups.length} groups`;
        
        return { content: [{ type: 'text', text }] };
      }

      case 'wa_get_contact_info': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const phoneOrName = args?.phone_or_name as string;
        if (!phoneOrName) {
          return { content: [{ type: 'text', text: 'Error: phone_or_name is required' }] };
        }

        const contactId = await findContact(phoneOrName);
        if (!contactId) {
          return { content: [{ type: 'text', text: `❌ Contact not found: ${phoneOrName}` }] };
        }

        const contact = await waClient.getContactById(contactId);
        
        let text = `👤 Contact Info\n\n`;
        text += `📛 Name: ${contact.name || contact.pushname || 'Unknown'}\n`;
        text += `📱 Number: ${contact.number}\n`;
        text += `🆔 ID: ${contact.id._serialized}\n`;
        text += `📍 Is Business: ${contact.isBusiness ? 'Yes' : 'No'}\n`;
        
        return { content: [{ type: 'text', text }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
  }
});

// Start server
async function main() {
  console.error('🚀 Starting WhatsApp MCP Server...');
  
  // Initialize WhatsApp in background
  initWhatsApp().catch(err => {
    console.error('WhatsApp init error:', err.message);
  });
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ WhatsApp MCP Server running on stdio');
}

main().catch(console.error);
