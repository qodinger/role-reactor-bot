import { addCoreCredits } from '../src/utils/ai/aiCreditManager.js';
import { getStorageManager } from '../src/utils/storage/storageManager.js';

async function main() {
  const userId = process.argv[2];
  const amount = parseFloat(process.argv[3]);

  if (!userId || !amount || isNaN(amount)) {
    console.log("Usage: node scripts/add-cores.js <discordId> <amount>");
    process.exit(1);
  }

  // Ensure storage is initialized first
  await getStorageManager();

  console.log(`Adding ${amount} cores to user ${userId}...`);
  const result = await addCoreCredits(userId, amount, 'manual_admin');
  
  if (result.success) {
    console.log(`✅ Successfully added cores! New balance: ${result.newBalance}`);
  } else {
    console.error(`❌ Failed to add cores: ${result.error}`);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
