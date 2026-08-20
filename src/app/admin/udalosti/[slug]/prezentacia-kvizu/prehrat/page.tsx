import { redirect } from "next/navigation";

type PageProps = { params: { slug: string } };

export default function LegacyPrezentaciaPrehratRedirect({ params }: PageProps) {
  redirect("/admin/hotove-kvizy");
}
