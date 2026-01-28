#!/usr/bin/env npx tsx

const TO = process.argv[2] || 'Mom';
const MESSAGE = process.argv[3] || 'Hello from WhatsApp MCP! 🤖';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const typeText = async (text: string, delay = 30) => {
  for (const char of text) {
    process.stdout.write(char);
    await sleep(delay);
  }
  console.log();
};

async function main() {
  console.log('🚀 Starting WhatsApp MCP...\n');
  await sleep(800);
  
  console.log('⏳ Connecting to WhatsApp...');
  await sleep(1500);
  
  console.log('🔐 Authenticated');
  await sleep(500);
  
  console.log('✅ WhatsApp ready!\n');
  await sleep(1000);
  
  process.stdout.write('> ');
  await typeText(`Send "${MESSAGE}" to ${TO}`, 40);
  await sleep(800);
  
  console.log(`\n📤 Sending message to ${TO}...`);
  await sleep(2000);
  
  console.log('✅ Message sent!\n');
  await sleep(500);
  
  console.log(`   To: ${TO}`);
  console.log(`   Message: "${MESSAGE}"`);
  console.log(`   Status: Delivered ✓✓\n`);
  await sleep(1000);
  
  console.log('👋 Done!');
}

main();
