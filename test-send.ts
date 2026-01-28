#!/usr/bin/env npx tsx
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

const TO = process.argv[2] || '';
const MESSAGE = process.argv[3] || 'Hello from WhatsApp MCP! 🤖';

if (!TO) {
  console.log('Usage: npx tsx test-send.ts <phone_number> [message]');
  console.log('Example: npx tsx test-send.ts 6281234567890 "Hello world"');
  process.exit(1);
}

console.log('🚀 Starting WhatsApp client...');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

let authenticated = false;
let loadingComplete = false;
let isReady = false;

const checkReady = async () => {
  if (authenticated && loadingComplete && !isReady) {
    isReady = true;
    console.log('✅ WhatsApp ready!');
    await sendMessage();
  }
};

const sendMessage = async () => {
  try {
    // Wait for client to fully initialize
    console.log('⏳ Waiting for WhatsApp to fully load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const chatId = TO.includes('@c.us') ? TO : `${TO}@c.us`;
    console.log(`📤 Sending to ${chatId}...`);
    
    // Get number info first
    const numberId = await client.getNumberId(TO);
    if (!numberId) {
      console.log('❌ Number not on WhatsApp');
      process.exit(1);
    }
    console.log(`✓ Number verified: ${numberId._serialized}`);
    
    const msg = await client.sendMessage(numberId._serialized, MESSAGE);
    
    console.log('✅ Message sent!');
    console.log(`   To: ${TO}`);
    console.log(`   Message: ${MESSAGE}`);
    
    // Wait a bit then exit
    setTimeout(() => {
      console.log('👋 Done!');
      process.exit(0);
    }, 2000);
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code:\n');
  qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
  console.log(`⏳ Loading: ${percent}%`);
  if (percent >= 99) {
    loadingComplete = true;
    setTimeout(checkReady, 3000);
  }
});

client.on('authenticated', () => {
  console.log('🔐 Authenticated');
  authenticated = true;
  checkReady();
});

client.on('ready', () => {
  if (!isReady) {
    isReady = true;
    console.log('✅ WhatsApp ready!');
    sendMessage();
  }
});

client.initialize();
