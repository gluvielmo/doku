import { PlayScreen } from "@/components/PlayScreen";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayScreen id={id} />;
}
