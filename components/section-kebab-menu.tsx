"use client";

import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SectionKebabMenuProps = {
  sectionId: string;
  sectionName: string;
  onCreate: () => void;
  onEdit: () => void;
  onAuditReport: () => void;
  onPrint: () => void;
};

export function SectionKebabMenu({
  onCreate,
  onEdit,
  onAuditReport,
  onPrint,
}: SectionKebabMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="h-8 w-8">
          <MoreVertical className="size-4" />
          <span className="sr-only">Section actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCreate}>Create section</DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>Edit Section</DropdownMenuItem>
        <DropdownMenuItem onClick={onAuditReport}>
          Audit Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}>Print ITR Report</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
