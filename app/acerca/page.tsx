import type { Metadata } from "next";
import { About } from "@/components/about";

export const metadata: Metadata = {
  title: "Acerca de",
};

export default function AboutPage() {
  return <About />;
}
