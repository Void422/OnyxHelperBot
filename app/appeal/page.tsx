import type { Metadata } from "next";
import { AppealPage } from "@/components/appeal-page";
export const metadata: Metadata = { title: "Appeal a moderation decision", description: "Sign in with Discord to review and appeal an eligible Onyx moderation action." };
export default function Page() { return <AppealPage />; }
