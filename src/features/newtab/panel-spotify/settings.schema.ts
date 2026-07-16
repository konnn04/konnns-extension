import { defineSchema } from "@/core/settings-engine/schema";

export const spotifySettingsSchema = defineSchema({
  clientId: {
    type: "text",
    label: "spotify.clientId",
    description: "spotify.clientIdDesc",
  },
});
