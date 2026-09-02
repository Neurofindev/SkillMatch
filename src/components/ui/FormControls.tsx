import { Check, ChevronDown, LoaderCircle } from 'lucide-react';
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

interface LoadableControl {
  isLoading?: boolean;
}

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>, LoadableControl {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, disabled, isLoading = false, ...props }, ref) => (
    <span className="control-shell">
      <input
        ref={ref}
        aria-busy={isLoading || undefined}
        className={cn('form-control', className)}
        disabled={disabled || isLoading}
        {...props}
      />
      {isLoading ? (
        <LoaderCircle
          className="control-loader motion-safe:animate-spin"
          aria-hidden="true"
        />
      ) : null}
    </span>
  ),
);

Input.displayName = 'Input';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, LoadableControl {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, disabled, isLoading = false, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-busy={isLoading || undefined}
      className={cn('form-control min-h-32 resize-y', className)}
      disabled={disabled || isLoading}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>, LoadableControl {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ children, className, disabled, isLoading = false, ...props }, ref) => (
    <span className="control-shell">
      <select
        ref={ref}
        aria-busy={isLoading || undefined}
        className={cn('form-control appearance-none pr-11', className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="control-icon" aria-hidden="true" />
    </span>
  ),
);

Select.displayName = 'Select';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, LoadableControl {
  label: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, disabled, isLoading = false, label, ...props }, ref) => (
    <label
      className={cn(
        'checkbox-label',
        (disabled || isLoading) && 'is-disabled',
        className,
      )}
    >
      <span className="checkbox-control">
        <input
          ref={ref}
          aria-busy={isLoading || undefined}
          disabled={disabled || isLoading}
          type="checkbox"
          {...props}
        />
        <span aria-hidden="true">
          <Check size={16} />
        </span>
      </span>
      <span>{label}</span>
    </label>
  ),
);

Checkbox.displayName = 'Checkbox';

export interface FormFieldControlProps {
  'aria-describedby'?: string;
  'aria-invalid': boolean;
  id: string;
}

export interface FormFieldProps {
  children: (props: FormFieldControlProps) => ReactNode;
  description?: string | undefined;
  error?: string | undefined;
  id: string;
  label: string;
  required?: boolean;
}

export function FormField({
  children,
  description,
  error,
  id,
  label,
  required = false,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ');

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {description ? (
        <p className="field-description" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
