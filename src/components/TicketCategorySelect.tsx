import { useState, useEffect } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { TicketCategoryItem } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tags, ChevronDown } from 'lucide-react';

interface TicketCategorySelectProps {
  ticketId?: string;
  selectedCategories: string[];
  onCategoriesChange: (categoryIds: string[]) => void;
  disabled?: boolean;
}

export const TicketCategorySelect = ({
  ticketId,
  selectedCategories,
  onCategoriesChange,
  disabled = false,
}: TicketCategorySelectProps) => {
  const { categories, loading, getTicketCategories } = useCategories();
  const [open, setOpen] = useState(false);

  // Load existing categories if editing a ticket
  useEffect(() => {
    if (ticketId) {
      getTicketCategories(ticketId).then((cats) => {
        onCategoriesChange(cats.map(c => c.id));
      });
    }
  }, [ticketId]);

  const activeCategories = categories.filter(c => c.active);
  const selectedCategoryObjects = categories.filter(c => selectedCategories.includes(c.id));

  const toggleCategory = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoriesChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      onCategoriesChange([...selectedCategories, categoryId]);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={disabled || loading}
          >
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4" />
              {selectedCategories.length === 0 ? (
                <span className="text-muted-foreground">Selecione categorias</span>
              ) : (
                <span>{selectedCategories.length} categoria(s)</span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="max-h-60 overflow-y-auto p-2">
            {activeCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">
                Nenhuma categoria disponível
              </p>
            ) : (
              activeCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer"
                  onClick={() => toggleCategory(category.id)}
                >
                  <Checkbox
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <Badge style={{ backgroundColor: category.color || '#6366f1', color: '#fff' }}>
                    {category.icon} {category.name}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedCategoryObjects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedCategoryObjects.map((category) => (
            <Badge
              key={category.id}
              variant="secondary"
              style={{ backgroundColor: category.color || '#6366f1', color: '#fff' }}
            >
              {category.icon} {category.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
