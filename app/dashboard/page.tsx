import type { Metadata } from "next";
import { ServerSelector } from "@/components/server-selector";

export const metadata: Metadata = { title: "Choose a server" };
export default function Dashboard() { return <ServerSelector />; }
