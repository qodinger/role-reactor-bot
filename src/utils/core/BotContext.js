class BotContext {
  constructor() {
    this.client = null;
    this.roleScheduler = null;
    this.tempRoleScheduler = null;
    this.pollCleanupInterval = null;
    this.giveawayManager = null;
    this.stopComfyUIRecovery = null;
    this.premiumScheduler = null;
    this.rpsCleanupStop = null;
    this.wyrCleanupStop = null;
  }

  async shutdown() {
    if (this.tempRoleScheduler) {
      this.tempRoleScheduler.stop();
    }
    if (this.roleScheduler) {
      this.roleScheduler.stop();
    }
    if (this.pollCleanupInterval) {
      clearInterval(this.pollCleanupInterval);
    }
    if (this.giveawayManager) {
      this.giveawayManager.destroy();
    }
    if (this.stopComfyUIRecovery) {
      this.stopComfyUIRecovery();
    }
    if (this.rpsCleanupStop) {
      this.rpsCleanupStop();
    }
    if (this.wyrCleanupStop) {
      this.wyrCleanupStop();
    }
    if (this.client) {
      this.client.destroy();
    }
  }
}

let botContext = null;

export function getBotContext() {
  if (!botContext) {
    botContext = new BotContext();
  }
  return botContext;
}

export function resetBotContext() {
  botContext = null;
}
