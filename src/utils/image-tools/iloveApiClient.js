import { getLogger } from "../logger.js";

const logger = getLogger();

const ILOVEAPI_BASE = "https://api.ilovepdf.com/v1";

// Map of tool names to iLoveAPI tool identifiers
const TOOL_MAP = {
  resize: "resizeimage",
  compress: "compressimage",
  convert: "convertimage",
  upscale: "upscaleimage",
};

/**
 * iLoveAPI client for image processing
 * Adapted from ai-upscaler/apps/web/lib/iloveapi.ts
 */
export class ILoveApiClient {
  #publicKey;
  #token = "";
  #tokenExpiry = 0;

  constructor(publicKey) {
    this.#publicKey = publicKey;
  }

  /**
   * Get or refresh auth token (expires after 1 hour)
   * @returns {Promise<string>}
   */
  async #getToken() {
    if (this.#token && Date.now() < this.#tokenExpiry) {
      return this.#token;
    }

    const response = await fetch(`${ILOVEAPI_BASE}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: this.#publicKey }),
    });

    if (!response.ok) {
      throw new Error(`iLoveAPI auth failed: ${response.status}`);
    }

    /** @type {any} */
    const data = await response.json();
    this.#token = data.token;
    // Refresh 5 minutes before expiry (tokens last 1 hour)
    this.#tokenExpiry = Date.now() + 55 * 60 * 1000;
    return this.#token;
  }

  /**
   * Make an authenticated request to iLoveAPI
   * @param {string} url
   * @param {RequestInit} [options]
   * @returns {Promise<Response>}
   */
  async #request(url, options = {}) {
    const token = await this.#getToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Start a new task for a given tool
   * @param {string} tool - Tool name (resize, compress, convert, upscale)
   * @returns {Promise<{ server: string, task: string, remainingCredits: number }>}
   */
  async startTask(tool) {
    const apiTool = TOOL_MAP[tool];
    if (!apiTool) throw new Error(`Unknown tool: ${tool}`);

    const response = await this.#request(`${ILOVEAPI_BASE}/start/${apiTool}`);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to start task: ${response.status} ${text}`);
    }

    /** @type {any} */
    const data = await response.json();
    return {
      server: data.server,
      task: data.task,
      remainingCredits: data.remaining_credits,
    };
  }

  /**
   * Upload a file buffer to the processing server
   * @param {string} server - Server hostname from startTask
   * @param {string} task - Task ID from startTask
   * @param {Buffer} fileBuffer - Image file buffer
   * @param {string} filename - Original filename
   * @returns {Promise<string>} server_filename for use in process call
   */
  async uploadFile(server, task, fileBuffer, filename) {
    const formData = new FormData(); // eslint-disable-line no-undef
    formData.append("task", task);
    formData.append("file", new Blob([fileBuffer]), filename); // eslint-disable-line no-undef

    const response = await fetch(`https://${server}/v1/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.#getToken()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    /** @type {any} */
    const data = await response.json();
    return data.server_filename;
  }

  /**
   * Process an uploaded file with the specified tool and options
   * @param {string} server - Server hostname
   * @param {string} task - Task ID
   * @param {string} serverFilename - Server filename from uploadFile
   * @param {string} tool - Tool name (resize, compress, convert, upscale)
   * @param {Object} options - Tool-specific processing options
   * @returns {Promise<{ status: string, downloadFilename: string, outputSize: number, outputExtensions: string }>}
   */
  async process(server, task, serverFilename, tool, options = {}) {
    const apiTool = TOOL_MAP[tool];
    if (!apiTool) throw new Error(`Unknown tool: ${tool}`);

    const body = {
      task,
      tool: apiTool,
      files: [
        {
          server_filename: serverFilename,
          filename: "image",
        },
      ],
      ...options,
    };

    const response = await fetch(`https://${server}/v1/process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.#getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Process failed: ${response.status} ${text}`);
    }

    /** @type {any} */
    const data = await response.json();
    return {
      status: data.status,
      downloadFilename: data.download_filename,
      outputSize: data.output_filenumber,
      outputExtensions: data.output_extensions,
    };
  }

  /**
   * Download the processed result
   * @param {string} server - Server hostname
   * @param {string} task - Task ID
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async download(server, task) {
    const response = await fetch(`https://${server}/v1/download/${task}`, {
      headers: {
        Authorization: `Bearer ${await this.#getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Full pipeline: start → upload → process → download
   * @param {string} tool - Tool name
   * @param {Buffer} fileBuffer - Image file buffer
   * @param {string} filename - Original filename
   * @param {Object} options - Tool-specific options
   * @returns {Promise<{ buffer: Buffer, result: { status: string, downloadFilename: string, outputSize: number, outputExtensions: string } }>}
   */
  async processImage(tool, fileBuffer, filename, options = {}) {
    const { server, task } = await this.startTask(tool);
    logger.debug(`iLoveAPI task started: ${tool} on ${server}`);

    const serverFilename = await this.uploadFile(
      server,
      task,
      fileBuffer,
      filename,
    );
    logger.debug(`iLoveAPI file uploaded: ${serverFilename}`);

    const result = await this.process(
      server,
      task,
      serverFilename,
      tool,
      options,
    );
    logger.debug(`iLoveAPI processing complete: ${result.status}`);

    const buffer = await this.download(server, task);
    logger.debug(`iLoveAPI result downloaded: ${buffer.length} bytes`);

    return { buffer, result };
  }
}

/**
 * Create a singleton client instance
 * @returns {ILoveApiClient}
 */
export function createImageToolsClient() {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error(
      "iLoveAPI key not configured. Set ILOVEPDF_PUBLIC_KEY environment variable.",
    );
  }

  return new ILoveApiClient(publicKey);
}
