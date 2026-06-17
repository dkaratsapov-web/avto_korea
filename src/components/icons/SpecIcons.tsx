import { Fuel, Gauge, Cog, LifeBuoy, type LucideProps } from "lucide-react";

/** Понятные иконки характеристик авто (на базе lucide-react). */

export function EngineIcon(props: LucideProps) {
  return <Fuel {...props} />;
}

export function MileageIcon(props: LucideProps) {
  return <Gauge {...props} />;
}

export function GearboxIcon(props: LucideProps) {
  return <Cog {...props} />;
}

export function DriveIcon(props: LucideProps) {
  return <LifeBuoy {...props} />;
}
