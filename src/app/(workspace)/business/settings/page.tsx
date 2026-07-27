import { redirect } from "next/navigation";

export default function LegacySettingsRoute() {
  redirect("/businesses");
}
