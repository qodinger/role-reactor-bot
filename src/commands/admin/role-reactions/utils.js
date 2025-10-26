import pLimit from "p-limit";

export { processRoles } from "../../../utils/discord/roleManager.js";
export {
  setRoleMapping,
  getAllRoleMappings,
  getRoleMapping,
} from "../../../utils/discord/roleMappingManager.js";

export function parallelLimit(limit = 3) {
  return pLimit(limit);
}

export function getColorChoices() {
  return [
    { name: "Default", value: "#9b8bf0" },
    { name: "Neon Blue", value: "#00BFFF" },
    { name: "Matrix Green", value: "#00FF00" },
    { name: "Cyber Red", value: "#FF0040" },
    { name: "Electric Yellow", value: "#FFFF00" },
    { name: "Quantum Purple", value: "#8A2BE2" },
    { name: "Plasma Orange", value: "#FF4500" },
    { name: "Synth Pink", value: "#FF1493" },
    { name: "Hologram Cyan", value: "#00FFFF" },
    { name: "Steel Brown", value: "#8B4513" },
    { name: "Chrome Gray", value: "#C0C0C0" },
  ];
}
