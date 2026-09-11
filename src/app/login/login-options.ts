export function loginOptionState(saveCredentials: boolean, remember: boolean, changed: "saveCredentials" | "remember") {
  if (changed === "remember" && remember) return { saveCredentials: true, remember: true };
  if (changed === "saveCredentials" && !saveCredentials) return { saveCredentials: false, remember: false };
  return { saveCredentials, remember };
}
