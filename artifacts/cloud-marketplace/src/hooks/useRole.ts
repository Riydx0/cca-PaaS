import { useUser } from "@clerk/react";

export type Role = "user" | "admin" | "super_admin";

export function useRole() {
  const { user, isLoaded } = useUser();
  const role = (user?.publicMetadata?.role as Role) ?? "user";

  return {
    role,
    isAdmin: role === "admin" || role === "super_admin",
    isSuperAdmin: role === "super_admin",
    isLoaded,
  };
}
