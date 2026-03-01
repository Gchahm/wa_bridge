import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { DocumentList } from '@/components/DocumentList'

interface ChatDocumentsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
  refreshKey: number
  onChanged?: () => void
}

export function ChatDocumentsSheet({
  open,
  onOpenChange,
  chatId,
  refreshKey,
  onChanged,
}: ChatDocumentsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Documents</SheetTitle>
          <SheetDescription>
            Tagged documents from this conversation.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4">
          <DocumentList
            chatId={chatId}
            refreshKey={refreshKey}
            onChanged={onChanged}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
