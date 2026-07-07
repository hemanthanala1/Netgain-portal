'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'
import { Input } from './input'
import { Textarea } from './textarea'
import { Search, DollarSign, Calendar as CalendarIcon } from 'lucide-react'

// Base Form Wrapper for Label, Helper Text, and Validation Error
interface FieldWrapperProps {
  label?: string
  helperText?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FieldWrapper({
  label,
  helperText,
  error,
  required,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn("space-y-1.5 w-full", className)}>
      {label && (
        <Label className="text-xs font-semibold text-muted-foreground/90 flex items-center gap-1">
          {label}
          {required && <span className="text-destructive font-bold">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-[11px] font-semibold text-destructive mt-1">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-[11px] text-muted-foreground/75 leading-normal mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  )
}

// 1. Text / Email / Password Input
interface FormInputProps extends React.ComponentPropsWithoutRef<typeof Input> {
  label?: string
  helperText?: string
  error?: string
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, helperText, error, required, className, ...props }, ref) => {
    return (
      <FieldWrapper label={label} helperText={helperText} error={error} required={required}>
        <Input
          ref={ref}
          className={cn(
            error && "border-destructive focus-visible:ring-destructive/30",
            className
          )}
          required={required}
          {...props}
        />
      </FieldWrapper>
    )
  }
)
FormInput.displayName = 'FormInput'

// 2. Textarea Input
interface FormTextareaProps extends React.ComponentPropsWithoutRef<typeof Textarea> {
  label?: string
  helperText?: string
  error?: string
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, helperText, error, required, className, ...props }, ref) => {
    return (
      <FieldWrapper label={label} helperText={helperText} error={error} required={required}>
        <Textarea
          ref={ref}
          className={cn(
            error && "border-destructive focus-visible:ring-destructive/30",
            className
          )}
          required={required}
          {...props}
        />
      </FieldWrapper>
    )
  }
)
FormTextarea.displayName = 'FormTextarea'

// 3. Currency / Value Input
interface FormCurrencyProps extends Omit<FormInputProps, 'type'> {}

export const FormCurrency = React.forwardRef<HTMLInputElement, FormCurrencyProps>(
  ({ label, helperText, error, required, className, ...props }, ref) => {
    return (
      <FieldWrapper label={label} helperText={helperText} error={error} required={required}>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={ref}
            type="number"
            step="0.01"
            className={cn(
              "pl-9",
              error && "border-destructive focus-visible:ring-destructive/30",
              className
            )}
            required={required}
            {...props}
          />
        </div>
      </FieldWrapper>
    )
  }
)
FormCurrency.displayName = 'FormCurrency'

// 4. Date Picker Input
interface FormDatePickerProps extends Omit<FormInputProps, 'type'> {}

export const FormDatePicker = React.forwardRef<HTMLInputElement, FormDatePickerProps>(
  ({ label, helperText, error, required, className, ...props }, ref) => {
    return (
      <FieldWrapper label={label} helperText={helperText} error={error} required={required}>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={ref}
            type="date"
            className={cn(
              "pl-9",
              error && "border-destructive focus-visible:ring-destructive/30",
              className
            )}
            required={required}
            {...props}
          />
        </div>
      </FieldWrapper>
    )
  }
)
FormDatePicker.displayName = 'FormDatePicker'

// 5. Select Dropdown Wrapper
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  error?: string
  options: { label: string; value: string }[]
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, helperText, error, required, options, className, ...props }, ref) => {
    return (
      <FieldWrapper label={label} helperText={helperText} error={error} required={required}>
        <select
          ref={ref}
          className={cn(
            "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground",
            error && "border-destructive focus-visible:ring-destructive/30",
            className
          )}
          required={required}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-card text-foreground">
              {opt.label}
            </option>
          ))}
        </select>
      </FieldWrapper>
    )
  }
)
FormSelect.displayName = 'FormSelect'

// 6. Checkbox Wrapper
interface FormCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  description?: string
  error?: string
}

export const FormCheckbox = React.forwardRef<HTMLInputElement, FormCheckboxProps>(
  ({ label, description, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-foreground/90 font-medium">
          <input
            ref={ref}
            type="checkbox"
            className={cn(
              "h-4 w-4 rounded border-input text-primary bg-background focus:ring-primary focus:ring-offset-background",
              error && "border-destructive",
              className
            )}
            {...props}
          />
          <div className="space-y-0.5">
            <span>{label}</span>
            {description && <p className="text-[10px] text-muted-foreground font-normal leading-tight">{description}</p>}
          </div>
        </label>
        {error && <p className="text-[10px] font-medium text-destructive mt-0.5">{error}</p>}
      </div>
    )
  }
)
FormCheckbox.displayName = 'FormCheckbox'

// 7. Toggle Switch Component
interface FormSwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  description?: string
}

export const FormSwitch = React.forwardRef<HTMLInputElement, FormSwitchProps>(
  ({ label, description, className, ...props }, ref) => {
    return (
      <label className="flex items-center justify-between gap-4 cursor-pointer select-none p-2 rounded-lg hover:bg-muted/10 transition-colors">
        <div className="space-y-0.5 text-xs font-semibold text-foreground/95">
          <p>{label}</p>
          {description && <p className="text-[10px] text-muted-foreground font-normal leading-normal">{description}</p>}
        </div>
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            className="sr-only peer"
            {...props}
          />
          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
        </div>
      </label>
    )
  }
)
FormSwitch.displayName = 'FormSwitch'
