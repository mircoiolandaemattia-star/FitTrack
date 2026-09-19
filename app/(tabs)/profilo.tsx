import { User } from "lucide-react-native";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function ProfiloScreen() {
  return (
    <PlaceholderScreen
      title="Profilo"
      subtitle="I tuoi dati, obiettivi e impostazioni dell'account."
      Icon={User}
    />
  );
}