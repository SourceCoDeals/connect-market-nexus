import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Search, 
  Filter,
  Calendar,
  DollarSign,
  User,
  Building,
  Mail,
  Phone,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useDeals, useDealStages, Deal } from '@/hooks/admin/use-deals';
import { format } from 'date-fns';

interface DealsListViewProps {
  onDealClick?: (deal: Deal) => void;
}

export const DealsListView = ({ onDealClick }: DealsListViewProps) => {
  const { data: deals = [], isLoading } = useDeals();
  const { data: stages = [] } = useDealStages();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const matchesSearch = searchQuery === '' || 
        deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.contact_company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.listing_title?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStage = selectedStage === '' || deal.stage_id === selectedStage;
      const matchesPriority = selectedPriority === '' || deal.deal_priority === selectedPriority;
      
      let matchesStatus = true;
      if (selectedStatus === 'overdue') {
        matchesStatus = deal.deal_expected_close_date && 
          new Date(deal.deal_expected_close_date) < new Date();
      } else if (selectedStatus === 'high_value') {
        matchesStatus = deal.deal_value > 1000000;
      } else if (selectedStatus === 'needs_followup') {
        matchesStatus = !deal.followed_up;
      }

      return matchesSearch && matchesStage && matchesPriority && matchesStatus;
    });
  }, [deals, searchQuery, selectedStage, selectedPriority, selectedStatus]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (deal: Deal) => {
    if (deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed') {
      return <CheckCircle className="h-4 w-4 text-success" />;
    } else if (deal.deal_expected_close_date && new Date(deal.deal_expected_close_date) < new Date()) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    } else {
      return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">Loading deals...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-0 bg-card/50 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Filter className="h-5 w-5 text-primary" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search deals..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select onValueChange={setSelectedStage} value={selectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Stages</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={setSelectedPriority} value={selectedPriority}>
              <SelectTrigger>
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={setSelectedStatus} value={selectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="high_value">High Value</SelectItem>
                <SelectItem value="needs_followup">Needs Follow-up</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('');
                setSelectedStage('');
                setSelectedPriority('');
                setSelectedStatus('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deals Table */}
      <Card className="border-0 bg-card/50 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">
            Deals ({filteredDeals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDeals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No deals found matching the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/50">
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Deal</TableHead>
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">Stage</TableHead>
                    <TableHead className="font-semibold">Priority</TableHead>
                    <TableHead className="font-semibold">Value</TableHead>
                    <TableHead className="font-semibold">Probability</TableHead>
                    <TableHead className="font-semibold">Close Date</TableHead>
                    <TableHead className="font-semibold">Assigned</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.map((deal) => (
                    <TableRow 
                      key={deal.deal_id} 
                      className="cursor-pointer hover:bg-muted/30 transition-colors duration-200 group"
                      onClick={() => onDealClick?.(deal)}
                    >
                      <TableCell>
                        {getStatusIcon(deal)}
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium">{deal.title}</div>
                          {deal.listing_title && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {deal.listing_title}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          {deal.contact_name && (
                            <div className="font-medium">{deal.contact_name}</div>
                          )}
                          {deal.contact_company && (
                            <div className="text-sm text-muted-foreground">
                              {deal.contact_company}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {deal.contact_email && (
                              <Mail className="h-3 w-3 text-muted-foreground" />
                            )}
                            {deal.contact_phone && (
                              <Phone className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge 
                          variant="outline"
                          style={{ 
                            borderColor: deal.stage_color,
                            color: deal.stage_color 
                          }}
                        >
                          {deal.stage_name}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant={getPriorityColor(deal.deal_priority)}>
                          {deal.deal_priority}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {formatCurrency(deal.deal_value)}
                        </div>
                      </TableCell>

                      <TableCell>
                        {deal.deal_probability}%
                      </TableCell>

                      <TableCell>
                        {deal.deal_expected_close_date ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(deal.deal_expected_close_date), 'MMM d, yyyy')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {deal.assigned_admin_name ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {getInitials(deal.assigned_admin_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{deal.assigned_admin_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDealClick?.(deal);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};