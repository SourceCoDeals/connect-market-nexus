import React from 'react';
import { PipelineShell } from '@/components/admin/pipeline/PipelineShell';
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';

export default function AdminPipeline() {
  return (
    <AdminErrorBoundary component="AdminPipeline">
      <PipelineShell />
    </AdminErrorBoundary>
  );
}