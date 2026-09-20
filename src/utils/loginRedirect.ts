export const formatLoginRedirect = (target: string | null) => {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return null;
  }
  try {
    const url = new URL(target, window.location.origin);
    if (
      url.origin !== window.location.origin ||
      url.pathname.split("/").includes("..")
    ) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

export const resolveLoginRedirect = (value: string | null) => {
  return formatLoginRedirect(value) ?? "/admin/dashboard";
};

export const loginPath = (pathname: string, search = "") => {
  const normalizedSearch =
    search && search !== "?" ? `?${search.replace(/^\?/, "")}` : "";
  const redirect = formatLoginRedirect(`${pathname}${normalizedSearch}`);
  return redirect
    ? `/admin/login?redirect=${encodeURIComponent(redirect)}`
    : "/admin/login";
};
