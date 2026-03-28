import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const setting = await prisma.einstellung.findUnique({
    where: { key: "system.logo" },
  });

  if (setting?.value && setting.value.startsWith("data:image")) {
    return new ImageResponse(
      // eslint-disable-next-line @next/next/no-img-element
      <img src={setting.value} width={180} height={180} style={{ objectFit: "contain" }} alt="" />,
      { ...size }
    );
  }

  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: "#16a34a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 30,
        color: "white",
        fontSize: 110,
        fontWeight: "bold",
      }}
    >
      A
    </div>,
    { ...size }
  );
}
