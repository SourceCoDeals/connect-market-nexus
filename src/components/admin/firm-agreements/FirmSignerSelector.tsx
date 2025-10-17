import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type FirmMember } from '@/hooks/admin/use-firm-agreements';

interface FirmSignerSelectorProps {
  members: FirmMember[];
  onSelect: (signedByUserId: string | null, signedByName: string | null) => void;
  label?: string;
}

export function FirmSignerSelector({ members, onSelect, label = 'Signed by' }: FirmSignerSelectorProps) {
  const [selectionType, setSelectionType] = useState<'member' | 'manual'>('member');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');

  const handleMemberSelect = (memberId: string) => {
    setSelectedMemberId(memberId);
    const member = members.find(m => m.user_id === memberId);
    if (member?.user) {
      onSelect(
        member.user_id,
        `${member.user.first_name} ${member.user.last_name}`.trim()
      );
    }
  };

  const handleManualNameChange = (name: string) => {
    setManualName(name);
    onSelect(null, name);
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      {/* Selection Type Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSelectionType('member')}
          className={`px-3 py-1.5 text-sm rounded-md ${
            selectionType === 'member'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          From Members
        </button>
        <button
          type="button"
          onClick={() => setSelectionType('manual')}
          className={`px-3 py-1.5 text-sm rounded-md ${
            selectionType === 'manual'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          Manual Entry
        </button>
      </div>

      {/* Member Selection */}
      {selectionType === 'member' && (
        <Select value={selectedMemberId} onValueChange={handleMemberSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Select a member..." />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.user_id} value={member.user_id}>
                {member.user?.first_name} {member.user?.last_name} ({member.user?.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Manual Name Entry */}
      {selectionType === 'manual' && (
        <Input
          value={manualName}
          onChange={(e) => handleManualNameChange(e.target.value)}
          placeholder="Enter signer name..."
        />
      )}
    </div>
  );
}
