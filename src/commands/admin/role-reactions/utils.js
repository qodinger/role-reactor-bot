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
    { name: "🔵 Pastel Blue", value: "#87CEEB" },
    { name: "🟢 Pastel Green", value: "#98FB98" },
    { name: "🔴 Pastel Red", value: "#F08080" },
    { name: "🟡 Pastel Yellow", value: "#F0E68C" },
    { name: "🟣 Pastel Purple", value: "#DDA0DD" },
    { name: "🟠 Pastel Orange", value: "#FFAB91" },
    { name: "🩷 Pastel Pink", value: "#FFB6C1" },
    { name: "🩵 Pastel Cyan", value: "#AFEEEE" },
    { name: "🟤 Pastel Brown", value: "#D2B48C" },
    { name: "🔘 Pastel Gray", value: "#D3D3D3" },
  ];
}
