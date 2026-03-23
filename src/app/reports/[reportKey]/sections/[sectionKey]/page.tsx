import { redirect } from "next/navigation";

export default async function SectionPageRedirect({
  params,
}: {
  params: Promise<{ reportKey: string; sectionKey: string }>;
}) {
  const { reportKey, sectionKey } = await params;
  redirect(`/reports/${reportKey}#section-${sectionKey}`);
}
