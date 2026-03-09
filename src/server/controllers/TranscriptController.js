import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * TranscriptController handles serving ticket transcripts via web
 */
export async function viewTranscript(req, res) {
  try {
    const { transcriptId } = req.params;

    // Valid transcriptId format: TRS-guildId-ticketNumber
    if (!transcriptId || !transcriptId.startsWith("TRS-")) {
      return res.status(400).send("Invalid transcript ID format.");
    }

    const storage = await getStorageManager();
    const transcript = await storage.getTicketTranscript(transcriptId);

    if (
      !transcript ||
      (!transcript.content &&
        (!transcript.messages || transcript.messages.length === 0))
    ) {
      return res.status(404).send(`
        <html>
          <body style="font-family: sans-serif; background: #36393f; color: white; display: flex; align-items: center; justify-content: center; height: 100vh;">
            <div style="text-align: center;">
              <h1>404 - Transcript Not Found</h1>
              <p>This transcript may have expired or does not exist.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Optimization: If content is missing, generate it on the fly from stored messages
    let html = transcript.content;
    if (!html && transcript.messages) {
      try {
        const { getTicketTranscript } = await import(
          "../../features/ticketing/TicketTranscript.js"
        );
        const ticketTranscript = getTicketTranscript();
        await ticketTranscript.initialize();

        // Construct a mock ticket object for the header from metadata
        const ticketInfo = {
          ticketId: transcript.ticketId,
          openedAt: transcript.metadata?.ticketOpenedAt,
          closedAt: transcript.metadata?.ticketClosedAt,
          isTruncated: transcript.metadata?.isTruncated || false,
        };

        html = ticketTranscript.generateHTML(transcript.messages, ticketInfo);
      } catch (genError) {
        logger.error(
          "Failed to generate transcript HTML on the fly:",
          genError,
        );
        return res.status(500).send("Error rendering transcript.");
      }
    }

    if (!html) {
      return res.status(404).send("Transcript content unavailable.");
    }

    // Serve the HTML content
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    logger.error("Error serving transcript:", error);
    res.status(500).send("Internal Server Error");
  }
}
