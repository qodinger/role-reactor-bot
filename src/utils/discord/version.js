import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(
  readFileSync(path.join(__dirname, "../../package.json"), "utf-8"),
);

export const BOT_VERSION = pkg.version;

// Get version string
const getVersion = () => BOT_VERSION;

// Get version info object
const getVersionInfo = () => {
  const [major, minor, patch] = BOT_VERSION.split(".").map(Number);
  return { major, minor, patch };
};

// Format version string
const formatVersion = versionInfo => {
  const { major, minor, patch, prerelease } = versionInfo;
  let version = `${major}.${minor}.${patch}`;
  if (prerelease) {
    version += `-${prerelease}`;
  }
  return version;
};

// Parse version string
const parseVersion = versionString => {
  if (!versionString || typeof versionString !== "string") {
    throw new Error("Invalid version string");
  }

  const [version, prerelease] = versionString.split("-");
  const parts = version.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid version format");
  }

  const [major, minor, patch] = parts.map(Number);

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error("Invalid version numbers");
  }

  return { major, minor, patch, prerelease };
};

// Compare two versions
const compareVersions = (version1, version2) => {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (v1.major !== v2.major) return v1.major - v2.major;
  if (v1.minor !== v2.minor) return v1.minor - v2.minor;
  if (v1.patch !== v2.patch) return v1.patch - v2.patch;
  return 0;
};

// Check if version is newer
const isNewerVersion = (version1, version2) => {
  return compareVersions(version1, version2) > 0;
};

// Check if version is older
const isOlderVersion = (version1, version2) => {
  return compareVersions(version1, version2) < 0;
};

// Get build information
const getBuildInfo = () => {
  return {
    version: BOT_VERSION,
    buildDate: new Date().toISOString().split("T")[0],
    nodeVersion: process.version,
  };
};

// Format build information
const formatBuildInfo = buildInfo => {
  return `Version: ${buildInfo.version}\nBuild Date: ${buildInfo.buildDate}\nNode Version: ${buildInfo.nodeVersion}`;
};

// Validate semantic version format
const isValidVersion = version => {
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
  return semverRegex.test(version);
};

// Check if version is in range
const isVersionInRange = (version, minVersion, maxVersion) => {
  return (
    compareVersions(version, minVersion) >= 0 &&
    compareVersions(version, maxVersion) <= 0
  );
};

export {
  getVersion,
  getVersionInfo,
  formatVersion,
  parseVersion,
  compareVersions,
  isNewerVersion,
  isOlderVersion,
  getBuildInfo,
  formatBuildInfo,
  isValidVersion,
  isVersionInRange,
};
