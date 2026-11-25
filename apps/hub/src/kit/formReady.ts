import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Whether a form's required fields are filled, for disabling its submit button instead of letting
 * the browser complain. Spread `form` on the `<form>`; pass `key` when its fields change.
 */
export function useFormReady(key?: unknown) {
  const ref = useRef<HTMLFormElement>(null);
  const [ready, setReady] = useState(false);
  const check = useCallback(() => setReady(!!ref.current?.matches(':valid')), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the form's fields
  useEffect(check, [check, key]);

  return {
    ready,
    form: {
      ref,
      onInput: check,
      onChange: check,
      onFocus: check,
      onReset: () => setTimeout(check),
    },
  };
}
