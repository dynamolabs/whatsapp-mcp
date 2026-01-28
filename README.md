# 📱 WhatsApp MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io/)

> Control WhatsApp through AI. Send messages, read chats, search conversations — all via natural language.

## 🤔 What is this?

MCP (Model Context Protocol) server that connects AI assistants (Claude, etc.) to WhatsApp. Instead of opening WhatsApp, just ask your AI:

- *"Send a message to John saying I'll be late"*
- *"Show me my recent chats"*
- *"Search for messages about the meeting"*
- *"What groups am I in?"*

## ✨ Features

### 📬 Messaging
| Tool | Description |
|------|-------------|
| `wa_send_message` | Send text message to contact or number |
| `wa_send_media` | Send images, documents, files |
| `wa_reply_message` | Reply to a specific message |
| `wa_react_message` | React to message with emoji |
| `wa_broadcast` | Send message to multiple contacts |

### 📖 Reading
| Tool | Description |
|------|-------------|
| `wa_get_chats` | List recent conversations |
| `wa_get_messages` | Read messages from a chat |
| `wa_search_messages` | Search messages by text |
| `wa_download_media` | Download images/videos/docs from chat |

### 👥 Contacts & Groups
| Tool | Description |
|------|-------------|
| `wa_get_contacts` | List all contacts |
| `wa_get_groups` | List WhatsApp groups |
| `wa_get_contact_info` | Get contact details |
| `wa_get_profile_pic` | Get profile picture URL |

### 👥 Group Management
| Tool | Description |
|------|-------------|
| `wa_create_group` | Create new WhatsApp group |
| `wa_group_info` | Get group details (members, admins) |
| `wa_add_to_group` | Add members to group |
| `wa_remove_from_group` | Remove members from group |
| `wa_leave_group` | Leave a group |

### ⚙️ Utilities
| Tool | Description |
|------|-------------|
| `wa_status` | Check connection status |
| `wa_mark_read` | Mark messages as read |
| `wa_forward_message` | Forward message to another chat |
| `wa_delete_message` | Delete your messages |
| `wa_star_message` | Star important messages |
| `wa_get_starred` | Get all starred messages |
| `wa_archive_chat` | Archive/unarchive chats |
| `wa_mute_chat` | Mute/unmute notifications |

### 📍 Special Messages
| Tool | Description |
|------|-------------|
| `wa_send_location` | Share location coordinates |
| `wa_send_contact` | Share contact card |

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/dynamolabs/whatsapp-mcp.git
cd whatsapp-mcp
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Connect WhatsApp

First run will show a QR code in terminal. Scan it with WhatsApp:
1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices
3. Tap "Link a Device"
4. Scan the QR code

Session is saved, so you only need to scan once.

## 🔌 Integration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/path/to/whatsapp-mcp/dist/index.js"]
    }
  }
}
```

### Clawdbot

Add to config:

```yaml
mcp:
  servers:
    - name: whatsapp
      command: node
      args: [/path/to/whatsapp-mcp/dist/index.js]
```

## 💬 Example Conversations

Once connected, ask your AI:

**Send Messages:**
> "Send 'Good morning!' to +62812345678"
> "Message John that the meeting is canceled"

**Read Chats:**
> "Show my recent WhatsApp chats"
> "What did Sarah say in our last conversation?"

**Search:**
> "Find messages about the project deadline"
> "Search for messages from last week about dinner"

**Contacts & Groups:**
> "List my WhatsApp contacts"
> "What groups am I part of?"

## ⚠️ Important Notes

1. **First Run**: You need to scan QR code on first run
2. **Session Persistence**: Auth is saved in `.wwebjs_auth/` folder
3. **One Device**: WhatsApp Web can only be connected to one browser session
4. **Rate Limits**: Don't spam messages or WhatsApp may ban your number

## 🔒 Security

- Your WhatsApp session is stored locally
- No data is sent to external servers
- Only the AI you connect to can access your WhatsApp

## 📁 Project Structure

```
whatsapp-mcp/
├── src/
│   └── index.ts      # MCP server implementation
├── dist/             # Compiled JavaScript
├── .wwebjs_auth/     # WhatsApp session (gitignored)
├── package.json
└── README.md
```

## 🤝 Contributing

Contributions welcome! Ideas for new features:
- Send images/media
- Voice message support
- Scheduled messages
- Read receipts
- Typing indicators

## 📄 License

MIT — use it however you want.

---

<p align="center">
  Built by <a href="https://twitter.com/callmedinamo">Dynamo</a> with 🤖
</p>
