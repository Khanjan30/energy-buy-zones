/** Static site: every page is built from the JSON files in web/data at build time. */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
