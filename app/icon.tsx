import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const setting = await prisma.einstellung.findUnique({
    where: { key: "system.logo" },
  });

  if (setting?.value && setting.value.startsWith("data:image")) {
    return new ImageResponse(
      // eslint-disable-next-line @next/next/no-img-element
      <img src={setting.value} width={32} height={32} style={{ objectFit: "contain" }} alt="" />,
      { ...size }
    );
  }

  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: "#16a34a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        color: "white",
        fontSize: 20,
        fontWeight: "bold",
      }}
    >
      A
    </div>,
    { ...size }
  );
}
