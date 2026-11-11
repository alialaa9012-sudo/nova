/** Props that tie an input to its error message for screen readers. */
export const fieldProps = (id: string, error?: string) => ({
  id,
  name: id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
})
