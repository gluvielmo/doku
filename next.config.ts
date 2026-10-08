import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Let phones on the same network use the dev server (http://<this-machine-ip>:3000).
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
};

export default nextConfig;
