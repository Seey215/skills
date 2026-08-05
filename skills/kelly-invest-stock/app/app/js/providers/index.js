export const getProvider = async () => {
  const demo = new URLSearchParams(window.location.search).get("demo") === "1";
  if (demo) return (await import("./demo-provider.js?v=0.8.0")).demoProvider;
  return (await import("./busabase-provider.js?v=0.8.0")).busabaseProvider;
};
