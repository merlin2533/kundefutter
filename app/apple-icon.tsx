import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LOGO_DATA_URI } from "@/lib/default-logo";

export const dynamic = "force-dynamic";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const setting = await prisma.einstellung.findUnique({
    where: { key: "system.logo" },
  });

  const src =
    setting?.value && setting.value.startsWith("data:image")
      ? setting.value
      : DEFAULT_LOGO_DATA_URI;

  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={180} height={180} style={{ objectFit: "contain" }} alt="" />,
    { ...size }
  );
}
