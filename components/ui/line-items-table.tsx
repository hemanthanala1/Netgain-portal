'use client'

import * as React from 'react'
import { useState } from 'react'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import { Textarea } from './textarea'
import { ServiceAutocomplete } from './service-autocomplete'
import { Plus, Trash2, ArrowUp, ArrowDown, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export interface LineItem {
  id?: string
  service_id?: string | null
  service_name: string
  description?: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  total: number
  sort_order: number
}

interface LineItemsTableProps {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  label?: string
  /** full = qty/tax/deliverables (SOW, agreements); simple = service, price, discount, total only */
  variant?: 'full' | 'simple'
}

function getServicePrice(svc: {
  price?: number
  quotationPrice?: number
  quotation_price?: number
  basePrice?: number
  base_price?: number
}): number {
  return Number(
    svc.quotationPrice ??
    svc.quotation_price ??
    svc.price ??
    svc.basePrice ??
    svc.base_price ??
    0
  ) || 0
}

function lineSubtotal(item: LineItem): number {
  return Number(item.unit_price) * Number(item.quantity || 1)
}

function lineTotal(item: LineItem): number {
  return Math.max(0, lineSubtotal(item) - Number(item.discount))
}

export function LineItemsTable({
  items,
  onChange,
  label = 'Document Line Items',
  variant = 'full',
}: LineItemsTableProps) {
  const [showSearch, setShowSearch] = useState(false)
  const isSimple = variant === 'simple'

  const handleAddService = (svc: any) => {
    const price = getServicePrice(svc)
    const newItem: LineItem = {
      id: Math.random().toString(36).substring(2, 9),
      service_id: svc.id,
      service_name: svc.name,
      description: isSimple ? '' : (svc.deliverables && Array.isArray(svc.deliverables) ? svc.deliverables.join('\n') : ''),
      quantity: 1,
      unit_price: price,
      discount: 0,
      tax: 0,
      total: price,
      sort_order: items.length,
    }
    onChange([...items, newItem])
    setShowSearch(false)
  }

  const handleAddCustom = () => {
    const newItem: LineItem = {
      id: Math.random().toString(36).substring(2, 9),
      service_id: null,
      service_name: 'Custom Service / Item',
      description: '',
      quantity: 1,
      unit_price: 0,
      discount: 0,
      tax: 0,
      total: 0,
      sort_order: items.length,
    }
    onChange([...items, newItem])
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= items.length) return
    const updated = [...items]
    const temp = updated[index]
    updated[index] = updated[nextIndex]
    updated[nextIndex] = temp

    updated.forEach((item, i) => {
      item.sort_order = i
    })
    onChange(updated)
  }

  const deleteItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index)
    updated.forEach((item, i) => {
      item.sort_order = i
    })
    onChange(updated)
  }

  const updateItem = (index: number, field: keyof LineItem, val: any) => {
    const updated = [...items]
    const item = { ...updated[index], [field]: val }

    if (field !== 'description' && field !== 'service_name' && field !== 'service_id' && field !== 'sort_order' && field !== 'id') {
      item.total = lineTotal(item)
    }

    updated[index] = item as LineItem
    onChange(updated)
  }

  const subtotal = items.reduce((sum, item) => sum + lineSubtotal(item), 0)
  const discountTotal = items.reduce((sum, item) => sum + item.discount, 0)
  const taxTotal = items.reduce(
    (sum, item) => sum + Math.round(lineTotal(item) * (item.tax / 100)),
    0
  )
  const grandTotal = items.reduce((sum, item) => sum + item.total, 0) + (isSimple ? 0 : taxTotal)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
        <h4 className="text-sm font-semibold text-gold uppercase tracking-wider">{label}</h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="h-8 gap-1.5 text-xs"
          >
            <Search className="h-3.5 w-3.5" />
            {showSearch ? 'Hide Search' : 'Search Services'}
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={handleAddCustom}
            className="h-8 gap-1.5 text-xs text-black"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Custom Item
          </Button>
        </div>
      </div>

      {showSearch && (
        <div className="p-3 border border-gold/20 bg-gold/5 rounded-lg space-y-2">
          <Label className="text-xs font-semibold text-gold">
            {isSimple ? 'Search and Add Service' : 'Search and Add Service Deliverables'}
          </Label>
          <ServiceAutocomplete
            placeholder="Search for an active service to insert..."
            onSelect={handleAddService}
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg text-sm text-muted-foreground bg-muted/5">
          No line items added yet. Search active services or add a custom item above.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="py-2.5 px-3 w-12 text-center">Sort</th>
                  <th className="py-2.5 px-3 min-w-[200px]">{isSimple ? 'Service Name' : 'Service / Item Name'}</th>
                  {!isSimple && <th className="py-2.5 px-3 min-w-[80px] w-20 text-right">Qty</th>}
                  <th className="py-2.5 px-3 min-w-[100px] w-28 text-right">{isSimple ? 'Price (₹)' : 'Unit Price (₹)'}</th>
                  <th className="py-2.5 px-3 min-w-[100px] w-28 text-right">Discount (₹)</th>
                  {!isSimple && <th className="py-2.5 px-3 min-w-[70px] w-20 text-right">Tax (%)</th>}
                  <th className="py-2.5 px-3 min-w-[100px] w-28 text-right">Total (₹)</th>
                  <th className="py-2.5 px-3 w-10 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <React.Fragment key={item.id || idx}>
                    <tr className="border-b border-border/50 hover:bg-muted/10 transition-colors align-top">
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col gap-1 items-center justify-center pt-1">
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 'down')}
                            disabled={idx === items.length - 1}
                            className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 space-y-1.5">
                        <Input
                          value={item.service_name}
                          onChange={(e) => updateItem(idx, 'service_name', e.target.value)}
                          className="h-8 text-xs font-semibold"
                          placeholder="Item or service title"
                        />
                        {!isSimple && (
                          <Textarea
                            value={item.description || ''}
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            className="text-xs h-14 resize-none"
                            placeholder="Item deliverables / description (one per line)"
                          />
                        )}
                      </td>
                      {!isSimple && (
                        <td className="py-3 px-3">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                            className="h-8 text-xs text-right pt-1"
                          />
                        </td>
                      )}
                      <td className="py-3 px-3">
                        <Input
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateItem(idx, 'unit_price', Math.max(0, Number(e.target.value)))}
                          className="h-8 text-xs text-right text-gold font-bold pt-1"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <Input
                          type="number"
                          min="0"
                          max={lineSubtotal(item)}
                          value={item.discount}
                          onChange={(e) => updateItem(idx, 'discount', Math.min(lineSubtotal(item), Math.max(0, Number(e.target.value))))}
                          className="h-8 text-xs text-right pt-1"
                        />
                      </td>
                      {!isSimple && (
                        <td className="py-3 px-3">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.tax}
                            onChange={(e) => updateItem(idx, 'tax', Math.min(100, Math.max(0, Number(e.target.value))))}
                            className="h-8 text-xs text-right pt-1"
                          />
                        </td>
                      )}
                      <td className="py-3 px-3 text-right font-semibold text-gold pt-4">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="py-3 px-3 text-center pt-3">
                        <button
                          type="button"
                          onClick={() => deleteItem(idx)}
                          className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {!isSimple && (
            <div className="flex justify-end">
              <div className="w-72 rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Line Item Discounts:</span>
                    <span>−{formatCurrency(discountTotal)}</span>
                  </div>
                )}
                {taxTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST Total (Line Items):</span>
                    <span>+{formatCurrency(taxTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gold border-t border-border/50 pt-2 text-sm">
                  <span>Calculated Total:</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
