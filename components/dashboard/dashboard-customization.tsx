'use client'

import * as React from 'react'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw, LayoutGrid } from 'lucide-react'

export interface WidgetConfig {
  id: string
  label: string
  visible: boolean
}

interface DashboardCustomizationProps {
  isOpen: boolean
  onClose: () => void
  role: string
  currentConfig: WidgetConfig[]
  onSave: (config: WidgetConfig[]) => void
  onReset: () => void
}

export function DashboardCustomization({
  isOpen,
  onClose,
  role,
  currentConfig,
  onSave,
  onReset
}: DashboardCustomizationProps) {
  const [config, setConfig] = React.useState<WidgetConfig[]>([])

  // Load config when drawer opens
  React.useEffect(() => {
    if (isOpen) {
      setConfig([...currentConfig])
    }
  }, [isOpen, currentConfig])

  const handleToggleVisibility = (id: string) => {
    setConfig(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w))
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    setConfig(prev => {
      const newConfig = [...prev]
      const temp = newConfig[index]
      newConfig[index] = newConfig[index - 1]
      newConfig[index - 1] = temp
      return newConfig
    })
  }

  const handleMoveDown = (index: number) => {
    if (index === config.length - 1) return
    setConfig(prev => {
      const newConfig = [...prev]
      const temp = newConfig[index]
      newConfig[index] = newConfig[index + 1]
      newConfig[index + 1] = temp
      return newConfig
    })
  }

  const handleSave = () => {
    onSave(config)
    onClose()
  }

  const handleReset = () => {
    onReset()
    onClose()
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Dashboard Layout"
      description={`Personalize the visibility and ordering of dashboard widgets for the ${role} portal view.`}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 mr-auto text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="gold" size="sm" onClick={handleSave}>Save Layout</Button>
        </>
      }
    >
      <div className="space-y-6 py-2">
        <div className="bg-muted/30 p-4 rounded-lg border border-border/30 flex items-start gap-3">
          <LayoutGrid className="h-5 w-5 text-gold shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-foreground">Layout Customization</h4>
            <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
              Toggle widget checkboxes to hide/show them. Use the Up/Down arrows to prioritize what you want to see first. Changes are saved to your current browser profile.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-gold uppercase tracking-wider">Dashboard Widgets</p>
          
          <div className="space-y-2">
            {config.map((widget, idx) => (
              <div 
                key={widget.id} 
                className={`p-3 rounded-lg border flex items-center justify-between gap-4 transition-all ${
                  widget.visible 
                    ? 'bg-card border-border/40' 
                    : 'bg-muted/15 border-border/10 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleToggleVisibility(widget.id)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                    title={widget.visible ? "Hide Widget" : "Show Widget"}
                  >
                    {widget.visible ? (
                      <Eye className="h-4 w-4 text-gold" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                  <span className="text-xs font-semibold text-foreground">{widget.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={idx === 0} 
                    onClick={() => handleMoveUp(idx)}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    title="Move Up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={idx === config.length - 1} 
                    onClick={() => handleMoveDown(idx)}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    title="Move Down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  )
}
