#!/usr/bin/env npx tsx
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

const TO = process.argv[2] || '';
const MESSAGE = process.argv[3] || 'Hello from WhatsApp MCP! 🤖';

if (!TO) {
  console.log('Usage: npx tsx test-send.ts <contact_name_or_phone> [message]');
  console.log('Example: npx tsx test-send.ts "Mom" "Hello!"');
  console.log('Example: npx tsx test-send.ts 6281234567890 "Hello!"');
  process.exit(1);
}

console.log('🚀 Starting WhatsApp client...');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
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
    console.log('⏳ Preparing to send...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const page = (client as any).pupPage;
    let targetDisplay = TO;
    
    // Check if it's a phone number or contact name
    const isPhoneNumber = /^[0-9+]+$/.test(TO.replace(/[\s-]/g, ''));
    
    if (isPhoneNumber) {
      const phone = TO.replace(/[^0-9]/g, '');
      await page.goto(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(MESSAGE)}`);
    } else {
      // It's a contact name - use search
      await page.goto('https://web.whatsapp.com');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Click search box and type contact name
      await page.keyboard.press('Escape'); // Close any open dialog
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use Ctrl+Alt+/ to open search or click search
      await page.click('[data-icon="search"]').catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await page.keyboard.type(TO, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Press down and enter to select first result
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Type message
      await page.keyboard.type(MESSAGE, { delay: 30 });
    }
    
    console.log(`📤 Sending message to "${targetDisplay}"...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Press Enter to send
    await page.keyboard.press('Enter');
    
    console.log('✅ Message sent!');
    console.log(`   To: ${targetDisplay}`);
    console.log(`   Message: "${MESSAGE}"`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('👋 Done!');
    process.exit(0);
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
