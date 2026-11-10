import { redirect } from "next/navigation";

/** The store dashboard moved to /store. */
export default function MerchantRedirect() {
  redirect("/store");
}
