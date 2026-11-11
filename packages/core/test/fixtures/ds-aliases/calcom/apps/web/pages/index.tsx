import { Button } from "@calcom/ui/components/button";
import { Logo } from "@calcom/lib/Logo";
import { Dialog } from "../../../packages/ui/components/dialog";
import { Shell } from "../components/Shell";
export default function Page() {
  return (
    <Shell>
      <Logo />
      <Button color="primary" />
      <Dialog />
    </Shell>
  );
}
