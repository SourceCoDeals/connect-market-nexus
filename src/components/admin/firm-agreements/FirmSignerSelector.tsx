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

  const handleMemberSelect = (compositeId: string) => {
    setSelectedMemberId(compositeId);
    
    // Parse composite identifier: "user:{user_id}" or "lead:{member_id}"
    const [type, id] = compositeId.split(':');
    
    if (type === 'user') {
      const member = members.find(m => m.user_id === id);
      if (member?.user) {
        onSelect(
          member.user_id,
          `${member.user.first_name} ${member.user.last_name}`.trim()
        );
      }
    } else if (type === 'lead') {
      const member = members.find(m => m.id === id);
      if (member) {
        onSelect(null, member.lead_name || '');
      }
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
            {members.map((member) => {
              // Marketplace user
              if (member.user_id && member.user) {
                return (
                  <SelectItem key={member.user_id} value={`user:${member.user_id}`}>
                    {member.user.first_name} {member.user.last_name} ({member.user.email})
                  </SelectItem>
                );
              }
              // Lead member
              else if (member.lead_name) {
                return (
                  <SelectItem key={member.id} value={`lead:${member.id}`}>
                    {member.lead_name} ({member.lead_email}) <span className="text-slate-500">• Lead</span>
                  </SelectItem>
                );
              }
              return null;
            })}
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
