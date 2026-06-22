import express from "express";
import { getDiscordClient } from "../../utils/apiShared.js";
import { createSuccessResponse } from "../../utils/responseHelpers.js";

const router = express.Router();

router.get("/status", (req, res) => {
  const client = getDiscordClient();
  const isReady = client?.isReady() ?? false;

  return res.json(
    createSuccessResponse({
      bot: {
        online: isReady,
        tag: client?.user?.tag ?? null,
        guilds: client?.guilds?.cache?.size ?? 0,
      },
    }),
  );
});

export default router;
