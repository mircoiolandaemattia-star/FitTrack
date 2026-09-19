import { Home as HomeIcon } from "lucide-react-native";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function HomeScreen() {
  return (
    <PlaceholderScreen
      title="Home"
      subtitle="Panoramica della tua attività: esercizio, alimentazione e obiettivi del giorno."
      Icon={HomeIcon}
    />
  );
}