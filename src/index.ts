#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, Message, Chat, Contact, MessageMedia, Location, GroupChat } = pkg;
import * as fs from 'fs';
import * as path from 'path';
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
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    waClient.on('qr', (qr) => {
      lastQR = qr;
      console.error('\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    });

    waClient.on('loading_screen', (percent, message) => {
      console.error(`⏳ Loading: ${percent}% - ${message}`);
    });

    waClient.on('ready', () => {
      isReady = true;
      console.error('✅ WhatsApp client is ready!');
      resolve();
    });

    waClient.on('authenticated', () => {
      console.error('🔐 WhatsApp authenticated');
    });

    waClient.on('change_state', (state) => {
      console.error(`🔄 State changed: ${state}`);
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
    {
      name: 'wa_send_media',
      description: 'Send an image or document to a WhatsApp contact',
      inputSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Phone number or contact name',
          },
          media_path: {
            type: 'string',
            description: 'Path to the image or document file',
          },
          caption: {
            type: 'string',
            description: 'Optional caption for the media',
          },
        },
        required: ['to', 'media_path'],
      },
    },
    {
      name: 'wa_reply_message',
      description: 'Reply to a specific message in a chat',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID or phone number',
          },
          message_id: {
            type: 'string',
            description: 'ID of the message to reply to (get from wa_get_messages)',
          },
          reply_text: {
            type: 'string',
            description: 'Reply message text',
          },
        },
        required: ['chat_id', 'message_id', 'reply_text'],
      },
    },
    {
      name: 'wa_react_message',
      description: 'React to a message with an emoji',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID or phone number',
          },
          message_id: {
            type: 'string',
            description: 'ID of the message to react to',
          },
          emoji: {
            type: 'string',
            description: 'Emoji to react with (e.g., 👍, ❤️, 😂)',
          },
        },
        required: ['chat_id', 'message_id', 'emoji'],
      },
    },
    {
      name: 'wa_mark_read',
      description: 'Mark all messages in a chat as read',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID or phone number to mark as read',
          },
        },
        required: ['chat_id'],
      },
    },
    {
      name: 'wa_get_profile_pic',
      description: 'Get profile picture URL of a contact or group',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID, phone number, or contact name',
          },
        },
        required: ['chat_id'],
      },
    },
    {
      name: 'wa_broadcast',
      description: 'Send the same message to multiple contacts at once',
      inputSchema: {
        type: 'object',
        properties: {
          recipients: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of phone numbers or contact names',
          },
          message: {
            type: 'string',
            description: 'Message to send to all recipients',
          },
        },
        required: ['recipients', 'message'],
      },
    },
    {
      name: 'wa_download_media',
      description: 'Download media from a message (image, video, document)',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID or phone number',
          },
          message_index: {
            type: 'number',
            description: 'Index of the message (0 = most recent)',
          },
          save_path: {
            type: 'string',
            description: 'Path to save the downloaded file',
          },
        },
        required: ['chat_id'],
      },
    },
    {
      name: 'wa_create_group',
      description: 'Create a new WhatsApp group',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Group name',
          },
          participants: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of phone numbers to add to the group',
          },
        },
        required: ['name', 'participants'],
      },
    },
    {
      name: 'wa_group_info',
      description: 'Get detailed information about a WhatsApp group',
      inputSchema: {
        type: 'object',
        properties: {
          group_id: {
            type: 'string',
            description: 'Group ID (get from wa_get_groups)',
          },
        },
        required: ['group_id'],
      },
    },
    {
      name: 'wa_add_to_group',
      description: 'Add participants to a WhatsApp group',
      inputSchema: {
        type: 'object',
        properties: {
          group_id: {
            type: 'string',
            description: 'Group ID',
          },
          participants: {
            type: 'array',
            items: { type: 'string' },
            description: 'Phone numbers to add',
          },
        },
        required: ['group_id', 'participants'],
      },
    },
    {
      name: 'wa_remove_from_group',
      description: 'Remove participants from a WhatsApp group (admin only)',
      inputSchema: {
        type: 'object',
        properties: {
          group_id: {
            type: 'string',
            description: 'Group ID',
          },
          participants: {
            type: 'array',
            items: { type: 'string' },
            description: 'Phone numbers to remove',
          },
        },
        required: ['group_id', 'participants'],
      },
    },
    {
      name: 'wa_forward_message',
      description: 'Forward a message to another chat',
      inputSchema: {
        type: 'object',
        properties: {
          from_chat_id: {
            type: 'string',
            description: 'Source chat ID',
          },
          message_id: {
            type: 'string',
            description: 'Message ID to forward',
          },
          to_chat_id: {
            type: 'string',
            description: 'Destination chat ID or phone number',
          },
        },
        required: ['from_chat_id', 'message_id', 'to_chat_id'],
      },
    },
    {
      name: 'wa_delete_message',
      description: 'Delete a message (only your own messages)',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID',
          },
          message_id: {
            type: 'string',
            description: 'Message ID to delete',
          },
          for_everyone: {
            type: 'boolean',
            description: 'Delete for everyone (true) or just for me (false)',
          },
        },
        required: ['chat_id', 'message_id'],
      },
    },
    {
      name: 'wa_star_message',
      description: 'Star or unstar a message',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID',
          },
          message_id: {
            type: 'string',
            description: 'Message ID to star',
          },
        },
        required: ['chat_id', 'message_id'],
      },
    },
    {
      name: 'wa_get_starred',
      description: 'Get all starred messages',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'wa_send_location',
      description: 'Send a location to a chat',
      inputSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Phone number or contact name',
          },
          latitude: {
            type: 'number',
            description: 'Latitude coordinate',
          },
          longitude: {
            type: 'number',
            description: 'Longitude coordinate',
          },
          description: {
            type: 'string',
            description: 'Location description/name',
          },
        },
        required: ['to', 'latitude', 'longitude'],
      },
    },
    {
      name: 'wa_send_contact',
      description: 'Send a contact card to a chat',
      inputSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Phone number or contact name to send to',
          },
          contact_phone: {
            type: 'string',
            description: 'Phone number of the contact to share',
          },
        },
        required: ['to', 'contact_phone'],
      },
    },
    {
      name: 'wa_archive_chat',
      description: 'Archive or unarchive a chat',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID or phone number',
          },
          archive: {
            type: 'boolean',
            description: 'true to archive, false to unarchive',
          },
        },
        required: ['chat_id', 'archive'],
      },
    },
    {
      name: 'wa_mute_chat',
      description: 'Mute or unmute a chat',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: {
            type: 'string',
            description: 'Chat ID or phone number',
          },
          mute: {
            type: 'boolean',
            description: 'true to mute, false to unmute',
          },
          duration: {
            type: 'string',
            description: 'Mute duration: "8h", "1w", or "forever" (default: forever)',
          },
        },
        required: ['chat_id', 'mute'],
      },
    },
    {
      name: 'wa_leave_group',
      description: 'Leave a WhatsApp group',
      inputSchema: {
        type: 'object',
        properties: {
          group_id: {
            type: 'string',
            description: 'Group ID to leave',
          },
        },
        required: ['group_id'],
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
          const hasMedia = msg.hasMedia ? ' 📎' : '';
          
          text += `${from} (${time})${hasMedia}:\n`;
          text += `${msg.body || '[Media/Sticker]'}\n`;
          text += `🆔 ID: ${msg.id.id}\n\n`;
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

      case 'wa_send_media': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const to = args?.to as string;
        const mediaPath = args?.media_path as string;
        const caption = args?.caption as string;

        if (!to || !mediaPath) {
          return { content: [{ type: 'text', text: 'Error: "to" and "media_path" are required' }] };
        }

        // Check if file exists
        if (!fs.existsSync(mediaPath)) {
          return { content: [{ type: 'text', text: `❌ File not found: ${mediaPath}` }] };
        }

        const chatId = await findContact(to);
        if (!chatId) {
          return { content: [{ type: 'text', text: `❌ Could not find contact: ${to}` }] };
        }

        const media = MessageMedia.fromFilePath(mediaPath);
        await waClient.sendMessage(chatId, media, { caption });

        return {
          content: [{
            type: 'text',
            text: `✅ Media sent to ${to}!\n\n📎 File: ${path.basename(mediaPath)}${caption ? `\n📝 Caption: ${caption}` : ''}`,
          }],
        };
      }

      case 'wa_reply_message': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatIdReply = args?.chat_id as string;
        const messageId = args?.message_id as string;
        const replyText = args?.reply_text as string;

        if (!chatIdReply || !messageId || !replyText) {
          return { content: [{ type: 'text', text: 'Error: chat_id, message_id, and reply_text are required' }] };
        }

        const formattedChatId = chatIdReply.includes('@') ? chatIdReply : formatPhoneToId(chatIdReply);
        const chat = await waClient.getChatById(formattedChatId);
        const messages = await chat.fetchMessages({ limit: 50 });
        
        // Find the message to reply to
        const targetMsg = messages.find(m => m.id._serialized === messageId || m.id.id === messageId);
        
        if (!targetMsg) {
          return { content: [{ type: 'text', text: `❌ Message not found: ${messageId}` }] };
        }

        await targetMsg.reply(replyText);

        return {
          content: [{
            type: 'text',
            text: `✅ Replied to message!\n\n💬 Original: ${targetMsg.body?.slice(0, 50)}...\n↩️ Reply: ${replyText}`,
          }],
        };
      }

      case 'wa_react_message': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatIdReact = args?.chat_id as string;
        const msgIdReact = args?.message_id as string;
        const emoji = args?.emoji as string;

        if (!chatIdReact || !msgIdReact || !emoji) {
          return { content: [{ type: 'text', text: 'Error: chat_id, message_id, and emoji are required' }] };
        }

        const formattedChatIdReact = chatIdReact.includes('@') ? chatIdReact : formatPhoneToId(chatIdReact);
        const chatReact = await waClient.getChatById(formattedChatIdReact);
        const messagesReact = await chatReact.fetchMessages({ limit: 50 });
        
        const targetMsgReact = messagesReact.find(m => m.id._serialized === msgIdReact || m.id.id === msgIdReact);
        
        if (!targetMsgReact) {
          return { content: [{ type: 'text', text: `❌ Message not found: ${msgIdReact}` }] };
        }

        await targetMsgReact.react(emoji);

        return {
          content: [{
            type: 'text',
            text: `✅ Reacted with ${emoji} to message!`,
          }],
        };
      }

      case 'wa_mark_read': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatIdRead = args?.chat_id as string;
        if (!chatIdRead) {
          return { content: [{ type: 'text', text: 'Error: chat_id is required' }] };
        }

        const formattedChatIdRead = chatIdRead.includes('@') ? chatIdRead : formatPhoneToId(chatIdRead);
        const chatRead = await waClient.getChatById(formattedChatIdRead);
        await chatRead.sendSeen();

        return {
          content: [{
            type: 'text',
            text: `✅ Marked ${chatRead.name} as read!`,
          }],
        };
      }

      case 'wa_get_profile_pic': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatIdPic = args?.chat_id as string;
        if (!chatIdPic) {
          return { content: [{ type: 'text', text: 'Error: chat_id is required' }] };
        }

        const contactIdPic = await findContact(chatIdPic);
        if (!contactIdPic) {
          return { content: [{ type: 'text', text: `❌ Contact not found: ${chatIdPic}` }] };
        }

        try {
          const picUrl = await waClient.getProfilePicUrl(contactIdPic);
          
          if (picUrl) {
            return {
              content: [{
                type: 'text',
                text: `🖼️ Profile Picture\n\n🔗 URL: ${picUrl}`,
              }],
            };
          } else {
            return {
              content: [{
                type: 'text',
                text: `ℹ️ No profile picture available for this contact.`,
              }],
            };
          }
        } catch (e) {
          return {
            content: [{
              type: 'text',
              text: `ℹ️ Could not get profile picture (may be private).`,
            }],
          };
        }
      }

      case 'wa_broadcast': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const recipients = args?.recipients as string[];
        const broadcastMsg = args?.message as string;

        if (!recipients || !broadcastMsg || recipients.length === 0) {
          return { content: [{ type: 'text', text: 'Error: recipients array and message are required' }] };
        }

        let successCount = 0;
        let failedRecipients: string[] = [];

        for (const recipient of recipients) {
          try {
            const chatId = await findContact(recipient);
            if (chatId) {
              await waClient.sendMessage(chatId, broadcastMsg);
              successCount++;
              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              failedRecipients.push(recipient);
            }
          } catch (e) {
            failedRecipients.push(recipient);
          }
        }

        let text = `📢 Broadcast Complete!\n\n`;
        text += `✅ Sent: ${successCount}/${recipients.length}\n`;
        if (failedRecipients.length > 0) {
          text += `❌ Failed: ${failedRecipients.join(', ')}`;
        }

        return { content: [{ type: 'text', text }] };
      }

      case 'wa_download_media': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatIdDl = args?.chat_id as string;
        const msgIndex = (args?.message_index as number) || 0;
        const savePath = args?.save_path as string;

        if (!chatIdDl) {
          return { content: [{ type: 'text', text: 'Error: chat_id is required' }] };
        }

        const formattedChatIdDl = chatIdDl.includes('@') ? chatIdDl : formatPhoneToId(chatIdDl);
        const chatDl = await waClient.getChatById(formattedChatIdDl);
        const messagesDl = await chatDl.fetchMessages({ limit: msgIndex + 10 });
        
        // Find messages with media
        const mediaMessages = messagesDl.filter(m => m.hasMedia);
        
        if (mediaMessages.length === 0) {
          return { content: [{ type: 'text', text: '❌ No media messages found in this chat.' }] };
        }

        const targetMsgDl = mediaMessages[msgIndex];
        if (!targetMsgDl) {
          return { content: [{ type: 'text', text: `❌ Media message at index ${msgIndex} not found.` }] };
        }

        const media = await targetMsgDl.downloadMedia();
        
        if (!media) {
          return { content: [{ type: 'text', text: '❌ Could not download media.' }] };
        }

        // If save path provided, save to file
        if (savePath) {
          const buffer = Buffer.from(media.data, 'base64');
          const ext = media.mimetype?.split('/')[1] || 'bin';
          const fullPath = savePath.includes('.') ? savePath : `${savePath}.${ext}`;
          fs.writeFileSync(fullPath, buffer);
          
          return {
            content: [{
              type: 'text',
              text: `✅ Media downloaded!\n\n📁 Saved to: ${fullPath}\n📊 Size: ${buffer.length} bytes\n📝 Type: ${media.mimetype}`,
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: `📎 Media Info\n\n📝 Type: ${media.mimetype}\n📊 Size: ~${Math.round(media.data.length * 0.75 / 1024)}KB\n\nProvide save_path to download.`,
          }],
        };
      }

      case 'wa_create_group': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const groupName = args?.name as string;
        const participants = args?.participants as string[];

        if (!groupName || !participants || participants.length === 0) {
          return { content: [{ type: 'text', text: 'Error: name and participants are required' }] };
        }

        // Format participant IDs
        const participantIds = participants.map(p => formatPhoneToId(p));

        try {
          const result = await waClient.createGroup(groupName, participantIds);
          const groupId = typeof result === 'string' ? result : (result as any).gid?._serialized || 'Unknown';
          
          return {
            content: [{
              type: 'text',
              text: `✅ Group created!\n\n👥 Name: ${groupName}\n🆔 ID: ${groupId}\n👤 Members: ${participants.length}`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Failed to create group: ${e.message}` }] };
        }
      }

      case 'wa_group_info': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const groupIdInfo = args?.group_id as string;
        if (!groupIdInfo) {
          return { content: [{ type: 'text', text: 'Error: group_id is required' }] };
        }

        try {
          const chat = await waClient.getChatById(groupIdInfo);
          
          if (!chat.isGroup) {
            return { content: [{ type: 'text', text: '❌ This is not a group chat.' }] };
          }

          const groupChat = chat as GroupChat;
          const participants = groupChat.participants || [];
          const admins = participants.filter(p => p.isAdmin || p.isSuperAdmin);

          let text = `👥 Group Info: ${groupChat.name}\n\n`;
          text += `🆔 ID: ${groupChat.id._serialized}\n`;
          text += `📝 Description: ${groupChat.description || 'No description'}\n`;
          text += `👤 Members: ${participants.length}\n`;
          text += `👑 Admins: ${admins.length}\n\n`;

          text += `👑 Admin List:\n`;
          for (const admin of admins.slice(0, 10)) {
            text += `  • ${admin.id.user}\n`;
          }

          text += `\n👤 Members (first 20):\n`;
          for (const member of participants.slice(0, 20)) {
            const role = member.isSuperAdmin ? '👑' : member.isAdmin ? '⭐' : '•';
            text += `  ${role} ${member.id.user}\n`;
          }

          if (participants.length > 20) {
            text += `  ... and ${participants.length - 20} more`;
          }

          return { content: [{ type: 'text', text }] };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_add_to_group': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const groupIdAdd = args?.group_id as string;
        const participantsAdd = args?.participants as string[];

        if (!groupIdAdd || !participantsAdd) {
          return { content: [{ type: 'text', text: 'Error: group_id and participants are required' }] };
        }

        try {
          const chat = await waClient.getChatById(groupIdAdd);
          if (!chat.isGroup) {
            return { content: [{ type: 'text', text: '❌ This is not a group chat.' }] };
          }

          const groupChat = chat as GroupChat;
          const participantIds = participantsAdd.map(p => formatPhoneToId(p));
          
          await groupChat.addParticipants(participantIds);

          return {
            content: [{
              type: 'text',
              text: `✅ Added ${participantsAdd.length} participant(s) to ${groupChat.name}!`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_remove_from_group': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const groupIdRemove = args?.group_id as string;
        const participantsRemove = args?.participants as string[];

        if (!groupIdRemove || !participantsRemove) {
          return { content: [{ type: 'text', text: 'Error: group_id and participants are required' }] };
        }

        try {
          const chat = await waClient.getChatById(groupIdRemove);
          if (!chat.isGroup) {
            return { content: [{ type: 'text', text: '❌ This is not a group chat.' }] };
          }

          const groupChat = chat as GroupChat;
          const participantIds = participantsRemove.map(p => formatPhoneToId(p));
          
          await groupChat.removeParticipants(participantIds);

          return {
            content: [{
              type: 'text',
              text: `✅ Removed ${participantsRemove.length} participant(s) from ${groupChat.name}!`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_forward_message': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const fromChatId = args?.from_chat_id as string;
        const msgIdFwd = args?.message_id as string;
        const toChatId = args?.to_chat_id as string;

        if (!fromChatId || !msgIdFwd || !toChatId) {
          return { content: [{ type: 'text', text: 'Error: from_chat_id, message_id, and to_chat_id are required' }] };
        }

        try {
          const formattedFromId = fromChatId.includes('@') ? fromChatId : formatPhoneToId(fromChatId);
          const chat = await waClient.getChatById(formattedFromId);
          const messages = await chat.fetchMessages({ limit: 50 });
          
          const targetMsg = messages.find(m => m.id._serialized === msgIdFwd || m.id.id === msgIdFwd);
          
          if (!targetMsg) {
            return { content: [{ type: 'text', text: `❌ Message not found: ${msgIdFwd}` }] };
          }

          const destId = await findContact(toChatId);
          if (!destId) {
            return { content: [{ type: 'text', text: `❌ Destination not found: ${toChatId}` }] };
          }

          await targetMsg.forward(destId);

          return {
            content: [{
              type: 'text',
              text: `✅ Message forwarded to ${toChatId}!`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_delete_message': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatIdDel = args?.chat_id as string;
        const msgIdDel = args?.message_id as string;
        const forEveryone = args?.for_everyone !== false;

        if (!chatIdDel || !msgIdDel) {
          return { content: [{ type: 'text', text: 'Error: chat_id and message_id are required' }] };
        }

        try {
          const formattedChatIdDel = chatIdDel.includes('@') ? chatIdDel : formatPhoneToId(chatIdDel);
          const chatDel = await waClient.getChatById(formattedChatIdDel);
          const messagesDel = await chatDel.fetchMessages({ limit: 50 });
          
          const targetMsgDel = messagesDel.find(m => m.id._serialized === msgIdDel || m.id.id === msgIdDel);
          
          if (!targetMsgDel) {
            return { content: [{ type: 'text', text: `❌ Message not found: ${msgIdDel}` }] };
          }

          if (!targetMsgDel.fromMe) {
            return { content: [{ type: 'text', text: `❌ Can only delete your own messages.` }] };
          }

          await targetMsgDel.delete(forEveryone);

          return {
            content: [{
              type: 'text',
              text: `✅ Message deleted${forEveryone ? ' for everyone' : ''}!`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_star_message': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatIdStar = args?.chat_id as string;
        const msgIdStar = args?.message_id as string;

        if (!chatIdStar || !msgIdStar) {
          return { content: [{ type: 'text', text: 'Error: chat_id and message_id are required' }] };
        }

        try {
          const formattedChatIdStar = chatIdStar.includes('@') ? chatIdStar : formatPhoneToId(chatIdStar);
          const chatStar = await waClient.getChatById(formattedChatIdStar);
          const messagesStar = await chatStar.fetchMessages({ limit: 50 });
          
          const targetMsgStar = messagesStar.find(m => m.id._serialized === msgIdStar || m.id.id === msgIdStar);
          
          if (!targetMsgStar) {
            return { content: [{ type: 'text', text: `❌ Message not found: ${msgIdStar}` }] };
          }

          await targetMsgStar.star();

          return {
            content: [{
              type: 'text',
              text: `⭐ Message starred!`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_get_starred': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        try {
          const chats = await waClient.getChats();
          let starredMessages: { chat: string; body: string; time: string }[] = [];

          for (const chat of chats.slice(0, 20)) {
            try {
              const messages = await chat.fetchMessages({ limit: 100 });
              const starred = messages.filter(m => m.isStarred);
              
              for (const msg of starred) {
                starredMessages.push({
                  chat: chat.name,
                  body: msg.body?.slice(0, 100) || '[Media]',
                  time: new Date(msg.timestamp * 1000).toLocaleString(),
                });
              }
            } catch (e) {
              // Skip chats that can't be fetched
            }
          }

          if (starredMessages.length === 0) {
            return { content: [{ type: 'text', text: '⭐ No starred messages found.' }] };
          }

          let text = `⭐ Starred Messages:\n\n`;
          for (const msg of starredMessages.slice(0, 20)) {
            text += `📍 ${msg.chat} (${msg.time}):\n`;
            text += `${msg.body}\n\n`;
          }

          return { content: [{ type: 'text', text }] };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_send_location': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const toLoc = args?.to as string;
        const latitude = args?.latitude as number;
        const longitude = args?.longitude as number;
        const locDescription = args?.description as string;

        if (!toLoc || latitude === undefined || longitude === undefined) {
          return { content: [{ type: 'text', text: 'Error: to, latitude, and longitude are required' }] };
        }

        try {
          const chatId = await findContact(toLoc);
          if (!chatId) {
            return { content: [{ type: 'text', text: `❌ Contact not found: ${toLoc}` }] };
          }

          const locationOptions = locDescription ? { name: locDescription } : undefined;
          const location = new Location(latitude, longitude, locationOptions);
          await waClient.sendMessage(chatId, location);

          return {
            content: [{
              type: 'text',
              text: `📍 Location sent to ${toLoc}!\n\n🌍 Coordinates: ${latitude}, ${longitude}${locDescription ? `\n📝 ${locDescription}` : ''}`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_send_contact': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const toContact = args?.to as string;
        const contactPhone = args?.contact_phone as string;

        if (!toContact || !contactPhone) {
          return { content: [{ type: 'text', text: 'Error: to and contact_phone are required' }] };
        }

        try {
          const chatId = await findContact(toContact);
          if (!chatId) {
            return { content: [{ type: 'text', text: `❌ Recipient not found: ${toContact}` }] };
          }

          const contactId = formatPhoneToId(contactPhone);
          const contact = await waClient.getContactById(contactId);
          
          // Create vCard
          const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name || contact.pushname || contact.number}\nTEL;type=CELL;type=VOICE;waid=${contact.number}:+${contact.number}\nEND:VCARD`;

          await waClient.sendMessage(chatId, vcard, { parseVCards: true });

          return {
            content: [{
              type: 'text',
              text: `📇 Contact sent to ${toContact}!\n\n👤 ${contact.name || contact.pushname || contact.number}`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_archive_chat': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatIdArchive = args?.chat_id as string;
        const shouldArchive = args?.archive as boolean;

        if (!chatIdArchive || shouldArchive === undefined) {
          return { content: [{ type: 'text', text: 'Error: chat_id and archive are required' }] };
        }

        try {
          const formattedId = chatIdArchive.includes('@') ? chatIdArchive : formatPhoneToId(chatIdArchive);
          const chat = await waClient.getChatById(formattedId);
          
          await chat.archive();

          return {
            content: [{
              type: 'text',
              text: `📦 Chat ${shouldArchive ? 'archived' : 'unarchived'}: ${chat.name}`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_mute_chat': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const chatIdMute = args?.chat_id as string;
        const shouldMute = args?.mute as boolean;
        const duration = args?.duration as string || 'forever';

        if (!chatIdMute || shouldMute === undefined) {
          return { content: [{ type: 'text', text: 'Error: chat_id and mute are required' }] };
        }

        try {
          const formattedId = chatIdMute.includes('@') ? chatIdMute : formatPhoneToId(chatIdMute);
          const chat = await waClient.getChatById(formattedId);
          
          if (shouldMute) {
            // Calculate mute date
            let unmuteDate: Date;
            if (duration === '8h') {
              unmuteDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
            } else if (duration === '1w') {
              unmuteDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            } else {
              // Forever - 1 year
              unmuteDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
            }
            await chat.mute(unmuteDate);
          } else {
            await chat.unmute();
          }

          return {
            content: [{
              type: 'text',
              text: `🔇 Chat ${shouldMute ? `muted (${duration})` : 'unmuted'}: ${chat.name}`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
      }

      case 'wa_leave_group': {
        if (!waClient || !isReady) {
          return { content: [{ type: 'text', text: '❌ WhatsApp not connected. Use wa_status first.' }] };
        }

        const groupIdLeave = args?.group_id as string;
        if (!groupIdLeave) {
          return { content: [{ type: 'text', text: 'Error: group_id is required' }] };
        }

        try {
          const chat = await waClient.getChatById(groupIdLeave);
          
          if (!chat.isGroup) {
            return { content: [{ type: 'text', text: '❌ This is not a group chat.' }] };
          }

          const groupChat = chat as GroupChat;
          await groupChat.leave();

          return {
            content: [{
              type: 'text',
              text: `👋 Left group: ${groupChat.name}`,
            }],
          };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `❌ Error: ${e.message}` }] };
        }
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
