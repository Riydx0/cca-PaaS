import { useAuth } from "@/contexts/AuthContext";

export type Role = "user" | "admin" | "super_admin";

export function useRole() {
  const { user, isLoaded } = useAuth();
  const role = (user?.role as Role) ?? "user";

  return {
    role,
    isAdmin: role === "admin" || role === "super_admin",
    isSuperAdmin: role === "super_admin",
    isLoaded,
  };
}
