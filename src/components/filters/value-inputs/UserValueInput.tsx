import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SelectValueInput } from "./SelectValueInput";

interface UserValueInputProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
}

export function UserValueInput({ value, onChange, multi }: UserValueInputProps) {
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("role", "admin");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const options = profiles.map((p) => ({
    label:
      p.first_name && p.last_name
        ? `${p.first_name} ${p.last_name}`
        : p.email ?? p.id,
    value: p.id,
  }));

  return (
    <SelectValueInput
      value={value}
      onChange={onChange}
      options={options}
      multi={multi}
      placeholder="Select user..."
    />
  );
}
