import { redirect } from "next/navigation";

// Old URL: orders now live at /orders/[id]. Safe to delete this folder.
export default async function Old({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/orders/${id}`);
}
